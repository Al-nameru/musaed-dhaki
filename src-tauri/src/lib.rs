mod ai_engine;
mod modules;

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use modules::ai::key_verification::{self, KeyVerificationResult};
use modules::ai::provider_detection::detect_text_provider;
use modules::ai::security;
use modules::selection::{self, SelectionMonitorState};

use modules::shortcuts::{self, ShortcutState};
use modules::usage_stats::{self, TokenStats};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use simplelog::{
    ColorChoice, CombinedLogger, Config, LevelFilter, TermLogger, TerminalMode, WriteLogger,
};
use std::fs::File;
use tauri::Manager;

const ALLOWED_PROVIDERS: &[&str] = &[
    "Groq",
    "Gemini",
    "OpenAI",
    "Anthropic",
    "DeepSeek",
    "Mistral",
    "xAI",
    "OpenRouter",
    "Google",
    "WebSpeech",
];
const MAX_KEY_LENGTH: usize = 256;
const MAX_TEXT_LENGTH: usize = 50_000;
const MAX_PROMPT_LENGTH: usize = 5_000;
const MAX_AUDIO_BASE64_LENGTH: usize = 20_000_000;

#[tauri::command]
async fn verify_api_key(key: String) -> Result<KeyVerificationResult, String> {
    if key.len() > MAX_KEY_LENGTH {
        return Err("API key is too long".into());
    }
    key_verification::verify_api_key(&key).await
}

pub(crate) struct KeyboardGuard {
    pub(crate) enigo: Enigo,
    pub(crate) keys_to_release: Vec<Key>,
}

impl KeyboardGuard {
    pub(crate) fn new(enigo: Enigo) -> Self {
        Self {
            enigo,
            keys_to_release: Vec::new(),
        }
    }

    pub(crate) fn press(&mut self, key: Key) -> Result<(), String> {
        self.enigo
            .key(key, Direction::Press)
            .map_err(|e| e.to_string())?;
        self.keys_to_release.push(key);
        Ok(())
    }

    pub(crate) fn click(&mut self, key: Key) -> Result<(), String> {
        self.enigo
            .key(key, Direction::Click)
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl Drop for KeyboardGuard {
    fn drop(&mut self) {
        while let Some(key) = self.keys_to_release.pop() {
            let _ = self.enigo.key(key, Direction::Release);
        }
        release_stuck_modifiers();
    }
}

/// يحرّر مفاتيح Ctrl/Shift/Alt/Win العالقة بعد محاكاة لوحة المفاتيح.
pub(crate) fn release_stuck_modifiers() {
    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        let _ = enigo.key(Key::Control, Direction::Release);
        let _ = enigo.key(Key::Shift, Direction::Release);
        let _ = enigo.key(Key::Alt, Direction::Release);
        let _ = enigo.key(Key::Meta, Direction::Release);
    }

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            keybd_event, KEYEVENTF_KEYUP, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT,
            VK_LWIN, VK_MENU, VK_RCONTROL, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT,
        };
        unsafe {
            for vk in [
                VK_CONTROL, VK_LCONTROL, VK_RCONTROL, VK_SHIFT, VK_LSHIFT, VK_RSHIFT, VK_MENU,
                VK_LMENU, VK_RMENU, VK_LWIN, VK_RWIN,
            ] {
                keybd_event(vk.0 as u8, 0, KEYEVENTF_KEYUP, 0);
            }
        }
    }
}

// التحقق مما إذا كانت النافذة تابعة للتطبيق نفسه
#[cfg(target_os = "windows")]
fn is_own_window(hwnd: windows::Win32::Foundation::HWND) -> bool {
    if hwnd.0.is_null() {
        return false;
    }
    let mut pid = 0;
    unsafe {
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid == windows::Win32::System::Threading::GetCurrentProcessId()
    }
}

#[cfg(not(target_os = "windows"))]
fn is_own_window(_hwnd: isize) -> bool {
    false
}

#[tauri::command]
async fn write_to_system(
    app: tauri::AppHandle,
    state: tauri::State<'_, SelectionMonitorState>,
    text: String,
    simulate_typing: bool,
    use_last_selection_target: Option<bool>,
    use_window_under_cursor: Option<bool>,
) -> Result<(), String> {
    let should_use_selection_target = use_last_selection_target.unwrap_or(false);
    let should_use_cursor_target = use_window_under_cursor.unwrap_or(false);
    let should_use_external_target = should_use_selection_target || should_use_cursor_target;

    // [FIX] حفظ HWND الهدف قبل إخفاء نوافذ التطبيق حتى لا يتغير WindowFromPoint بعد الإخفاء
    #[cfg(target_os = "windows")]
    let pre_captured_hwnd: Option<isize> = {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetAncestor, GetCursorPos, WindowFromPoint, GA_ROOT,
        };
        let mut point = POINT::default();
        let mut result = None;
        if unsafe { GetCursorPos(&mut point).is_ok() } {
            let hwnd = unsafe { WindowFromPoint(point) };
            if !hwnd.0.is_null() && !is_own_window(hwnd) {
                let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
                let target = if !root.0.is_null() { root } else { hwnd };
                if !is_own_window(target) {
                    result = Some(target.0 as isize);
                }
            }
        }
        result
    };

    if should_use_external_target {
        if let Some(overlay) = app.get_webview_window("overlay") {
            let _ = overlay.hide();
        }
        // [FIX] Do not hide the main window during external paste so that it doesn't disappear from the screen
        // if let Some(main) = app.get_webview_window("main") {
        //     let _ = main.hide();
        // }
        // انتظار قصير لضمان اختفاء النوافذ من نظام التشغيل قبل إرسال التركيز
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    }

    let mut focused = false;

    #[cfg(target_os = "windows")]
    {
        if let Some(hwnd_id) = pre_captured_hwnd {
            focus_hwnd(hwnd_id).await;
            focused = true;
        }
    }

    if !focused && should_use_external_target {
        focus_last_selection_target(&state).await;
    }

    if simulate_typing {
        // انتظار حصول النافذة الهدف على التركيز قبل الكتابة
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
        enigo.text(&text).map_err(|e| e.to_string())?;
    } else {
        // Copy to clipboard
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text).map_err(|e| e.to_string())?;

        // انتظار كافٍ لضمان أن النافذة الهدف أصبحت نشطة وأن الحافظة استُقبلت من نظام التشغيل
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        release_stuck_modifiers();

        let mut guard = KeyboardGuard::new(Enigo::new(&Settings::default()).map_err(|e| e.to_string())?);

        // Simulate Paste command (Ctrl+V or Cmd+V)
        #[cfg(target_os = "macos")]
        {
            guard.press(Key::Meta)?;
            guard.click(Key::Unicode('v'))?;
        }
        #[cfg(not(target_os = "macos"))]
        {
            guard.press(Key::Control)?;
            guard.click(Key::Unicode('v'))?;
        }
    }

    release_stuck_modifiers();

    if should_use_external_target {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let config = crate::modules::audio::config::load_config(&app);
        if !config.active {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) async fn focus_hwnd(hwnd_id: isize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentProcessId, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VK_MENU,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsIconic,
        SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
    };

    let hwnd = HWND(hwnd_id as _);
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == GetCurrentProcessId() {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            } else {
                let _ = ShowWindow(hwnd, SW_SHOW);
            }
            return;
        }
    }

    let hwnd = HWND(hwnd_id as _);
    unsafe {
        let current_thread = GetCurrentThreadId();
        let target_thread = GetWindowThreadProcessId(hwnd, None);
        let foreground = GetForegroundWindow();
        let foreground_thread = if !foreground.0.is_null() {
            GetWindowThreadProcessId(foreground, None)
        } else {
            0
        };

        if foreground_thread != 0 && foreground_thread != current_thread {
            let _ = AttachThreadInput(current_thread, foreground_thread, true);
        }
        if target_thread != 0 && target_thread != current_thread {
            let _ = AttachThreadInput(current_thread, target_thread, true);
        }

        keybd_event(VK_MENU.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);

        // [FIX] تحقق من حالة النافذة أولاً:
        // - مُصغَّرة (Minimized/Iconic): استعدها بـ SW_RESTORE
        // - مُكبَّرة (Maximized) أو عادية: استخدم SW_SHOW فقط بدون تغيير الحجم
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        } else {
            let _ = ShowWindow(hwnd, SW_SHOW);
        }

        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);

        if target_thread != 0 && target_thread != current_thread {
            let _ = AttachThreadInput(current_thread, target_thread, false);
        }
        if foreground_thread != 0 && foreground_thread != current_thread {
            let _ = AttachThreadInput(current_thread, foreground_thread, false);
        }
    }
    tokio::time::sleep(std::time::Duration::from_millis(220)).await;
}

#[cfg(target_os = "windows")]
async fn focus_last_selection_target(state: &tauri::State<'_, SelectionMonitorState>) {
    if let Some(hwnd_id) = state.last_target_hwnd() {
        focus_hwnd(hwnd_id).await;
    }
}

#[cfg(not(target_os = "windows"))]
async fn focus_last_selection_target(_state: &tauri::State<'_, SelectionMonitorState>) {}

#[tauri::command]
async fn ai_transcribe(
    app: tauri::AppHandle,
    api_key: String,
    provider: String,
    model: String,
    audio_base64: String,
    language: String,
) -> Result<String, String> {
    if api_key.len() > MAX_KEY_LENGTH {
        return Err("API key is too long".into());
    }
    if !ALLOWED_PROVIDERS.contains(&provider.as_str()) {
        return Err("Provider not allowed".into());
    }
    if audio_base64.len() > MAX_AUDIO_BASE64_LENGTH {
        return Err("Audio file is too large".into());
    }
    let (text, prompt_tokens, completion_tokens) =
        ai_engine::transcribe_audio(&api_key, &provider, &model, &audio_base64, &language).await?;

    let completion_chars = text.chars().count() as u32;
    let completion_words = text.split_whitespace().count() as u32;

    usage_stats::record(
        &app,
        usage_stats::RecordPayload {
            provider: &provider,
            model: &model,
            action: "transcribe",
            prompt_tokens,
            completion_tokens,
            prompt_chars: 0,
            completion_chars,
            prompt_words: 0,
            completion_words,
        },
    );
    Ok(text)
}

#[tauri::command]
async fn ai_process_text(
    app: tauri::AppHandle,
    api_key: String,
    model: String,
    action: String,
    text: String,
    custom_prompt: Option<String>,
) -> Result<String, String> {
    if api_key.len() > MAX_KEY_LENGTH {
        return Err("API key is too long".into());
    }
    if text.len() > MAX_TEXT_LENGTH {
        return Err("Text is too long".into());
    }
    if let Some(ref p) = custom_prompt {
        if p.len() > MAX_PROMPT_LENGTH {
            return Err("Custom prompt is too long".into());
        }
    }
    let provider = detect_text_provider(&api_key, &model);

    let (processed, prompt_tokens, completion_tokens) =
        ai_engine::process_text(&api_key, &model, &action, &text, custom_prompt).await?;

    let prompt_chars = text.chars().count() as u32;
    let prompt_words = text.split_whitespace().count() as u32;
    let completion_chars = processed.chars().count() as u32;
    let completion_words = processed.split_whitespace().count() as u32;

    usage_stats::record(
        &app,
        usage_stats::RecordPayload {
            provider,
            model: &model,
            action: &action,
            prompt_tokens,
            completion_tokens,
            prompt_chars,
            completion_chars,
            prompt_words,
            completion_words,
        },
    );
    Ok(processed)
}

#[tauri::command]
fn get_token_usage_stats(app: tauri::AppHandle) -> Result<TokenStats, String> {
    Ok(usage_stats::read(&app))
}

#[tauri::command]
fn reset_token_usage_stats(app: tauri::AppHandle) -> Result<(), String> {
    usage_stats::reset(&app)
}

#[tauri::command]
async fn ai_speak_text(text: String, provider: String) -> Result<String, String> {
    if text.len() > MAX_TEXT_LENGTH {
        return Err("Text is too long".into());
    }
    if !ALLOWED_PROVIDERS.contains(&provider.as_str()) {
        return Err("Provider not allowed".into());
    }
    let bytes = ai_engine::synthesize_speech(&text, &provider).await?;
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes);
    Ok(b64)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct InspectedElement {
    selector: String,
    text: String,
    tag_name: String,
    classes: String,
    id: String,
    timestamp: u64,
}

#[tauri::command]
fn save_inspected_element(
    app: tauri::AppHandle,
    selector: String,
    text: String,
    tag_name: String,
    classes: String,
    id: String,
) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_dir.join("inspected_elements");
    std::fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    let file_path = backups_dir.join("inspected_elements.json");

    let mut list: Vec<InspectedElement> = match std::fs::read_to_string(&file_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let el = InspectedElement {
        selector,
        text,
        tag_name,
        classes,
        id,
        timestamp,
    };

    list.push(el);

    if list.len() > 50 {
        let drain_len = list.len() - 50;
        list.drain(0..drain_len);
    }

    let json_str = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

pub struct StartupState {
    pub logging_error: std::sync::Mutex<Option<String>>,
}

#[tauri::command]
async fn take_screenshot(save_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        let ps_script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             Add-Type -AssemblyName System.Drawing; \
             $screen = [System.Windows.Forms.Screen]::PrimaryScreen; \
             $bounds = $screen.Bounds; \
             $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; \
             $graphics = [System.Drawing.Graphics]::FromImage($bmp); \
             $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bmp.Size); \
             $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $graphics.Dispose(); \
             $bmp.Dispose();",
            save_path.replace("'", "''")
        );

        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("PowerShell error: {}", err_msg));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Unsupported operating system for screenshot capture".into())
    }
}

#[tauri::command]
fn get_startup_warnings(state: tauri::State<'_, StartupState>) -> Option<String> {
    state.logging_error.lock().unwrap().clone()
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::Input::KeyboardAndMouse::{
                keybd_event, KEYEVENTF_KEYUP, VK_MENU,
            };
            use windows::Win32::UI::WindowsAndMessaging::{
                BringWindowToTop, GetForegroundWindow, SetForegroundWindow, ShowWindow, SW_RESTORE,
                SW_SHOW, IsIconic,
            };
            if let Ok(hwnd) = w.hwnd() {
                let fg = unsafe { GetForegroundWindow() };
                let already_focused = fg.0 == hwnd.0;
                unsafe {
                    if !already_focused {
                        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
                        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
                    }
                    if IsIconic(hwnd).as_bool() {
                        let _ = ShowWindow(hwnd, SW_RESTORE);
                    } else {
                        let _ = ShowWindow(hwnd, SW_SHOW);
                    }
                    if !already_focused {
                        let _ = BringWindowToTop(hwnd);
                        let _ = SetForegroundWindow(hwnd);
                    }
                }
            }
        }
        let _ = w.unminimize();
        let _ = w.show();
        if let Ok(hwnd) = w.hwnd() {
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
                let fg = unsafe { GetForegroundWindow() };
                if fg.0 != hwnd.0 {
                    let _ = w.set_focus();
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = w.set_focus();
            }
        }
    }
    Ok(())
}
#[tauri::command]
fn show_hud_notification(app: tauri::AppHandle, icon: String, text: String) {
    selection::overlay::show_hud_notification(&app, &icon, &text);
}

fn init_logging(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;
    let log_path = app_dir.join("smart_assistant.log");
    let log_file = File::create(log_path)?;

    let _ = CombinedLogger::init(vec![
        TermLogger::new(
            LevelFilter::Info,
            Config::default(),
            TerminalMode::Mixed,
            ColorChoice::Auto,
        ),
        WriteLogger::new(LevelFilter::Info, Config::default(), log_file),
    ]);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let state_str = match event.state() {
                        tauri_plugin_global_shortcut::ShortcutState::Pressed => "pressed",
                        tauri_plugin_global_shortcut::ShortcutState::Released => "released",
                    };
                    if let Some(state) = app.try_state::<ShortcutState>() {
                        let event_name = {
                            let map = state.shortcuts.lock().unwrap();
                            let mut found_name = None;
                            for (name, saved_shortcut) in map.iter() {
                                if saved_shortcut == shortcut {
                                    found_name = Some(name.clone());
                                    break;
                                }
                            }
                            found_name
                        };
                        if let Some(name) = event_name {
                            modules::shortcuts::handle_shortcut_trigger(app, &name, state_str);
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            verify_api_key,
            write_to_system,
            ai_transcribe,
            ai_process_text,
            ai_speak_text,
            selection::copy_selected_text,
            shortcuts::register_custom_shortcut,
            shortcuts::unregister_custom_shortcut,
            shortcuts::direct_dictation_toggle,
            shortcuts::direct_dictation_is_active,
            selection::set_selection_monitor_enabled,
            selection::capture_external_target,
            selection::overlay::hide_selection_overlay,
            selection::overlay::run_overlay_action,
            get_token_usage_stats,
            reset_token_usage_stats,
            security::save_secure_api_key,
            security::load_secure_api_key,
            security::delete_secure_api_key,
            security::load_all_secure_api_keys,
            security::export_settings_backup,
            security::import_settings_backup,
            save_inspected_element,
            take_screenshot,
            get_startup_warnings,
            focus_main_window,
            show_hud_notification,
            modules::audio::config::save_background_config,
            modules::audio::config::load_background_config
        ])
        .setup(|app| {
            let logging_error = match init_logging(app) {
                Ok(_) => None,
                Err(e) => Some(format!("Failed to initialize logging: {}", e)),
            };
            app.manage(StartupState {
                logging_error: std::sync::Mutex::new(logging_error),
            });
            app.manage(ShortcutState::new());
            app.manage(modules::audio::recorder::RecorderState::new());

            selection::overlay::create_overlay_window(app.handle())?;

            let selection_state = SelectionMonitorState::new(true);
            let selection_monitor_enabled = selection_state.enabled_handle();
            let selection_target_hwnd = selection_state.target_hwnd_handle();
            app.manage(selection_state);
            selection::start_selection_monitor(
                app.handle().clone(),
                selection_monitor_enabled,
                selection_target_hwnd,
            );

            #[cfg(target_os = "windows")]
            shortcuts::start_keyboard_monitor(app.handle().clone());

            // System Tray Setup
            let quit_menu_item = MenuItem::with_id(app, "quit", "خروج (Quit)", true, None::<&str>)?;
            let show_menu_item = MenuItem::with_id(app, "show", "فتح المساعد (Open Assistant)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_menu_item, &quit_menu_item])?;

            let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
                tauri::image::Image::new_owned(vec![0; 32 * 32 * 4], 32, 32)
            });

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(icon)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        release_stuck_modifiers();
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Down,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Window Close Request Override
            if let Some(main_window) = app.get_webview_window("main") {
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        release_stuck_modifiers();
                        let _ = main_window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} // Force rebuild frontend assets v1.0.2
