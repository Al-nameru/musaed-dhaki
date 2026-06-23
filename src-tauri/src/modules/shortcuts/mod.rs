use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::OnceLock;
use std::sync::mpsc::{channel, Sender};

use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri::Manager;

use crate::focus_hwnd;
use crate::release_stuck_modifiers;
use crate::KeyboardGuard;
use arboard::Clipboard;
use enigo::{Enigo, Key, Settings};

pub struct ShortcutState {
    pub(crate) shortcuts: Mutex<HashMap<String, Shortcut>>,
    signatures: Mutex<HashMap<String, String>>,
    pub bypassed_keys: Mutex<HashMap<String, String>>,
    speech_runtime: Mutex<SpeechShortcutRuntime>,
}

struct SpeechShortcutRuntime {
    last_press: Option<std::time::Instant>,
    long_press_cancel: Option<Arc<AtomicBool>>,
}

impl SpeechShortcutRuntime {
    fn new() -> Self {
        Self {
            last_press: None,
            long_press_cancel: None,
        }
    }
}

impl ShortcutState {
    pub fn new() -> Self {
        Self {
            shortcuts: Mutex::new(HashMap::new()),
            signatures: Mutex::new(HashMap::new()),
            bypassed_keys: Mutex::new(HashMap::new()),
            speech_runtime: Mutex::new(SpeechShortcutRuntime::new()),
        }
    }
}

fn shortcut_code(key: &str) -> Result<Code, String> {
    match key.to_uppercase().as_str() {
        "A" => Ok(Code::KeyA),
        "B" => Ok(Code::KeyB),
        "C" => Ok(Code::KeyC),
        "D" => Ok(Code::KeyD),
        "E" => Ok(Code::KeyE),
        "F" => Ok(Code::KeyF),
        "G" => Ok(Code::KeyG),
        "H" => Ok(Code::KeyH),
        "I" => Ok(Code::KeyI),
        "J" => Ok(Code::KeyJ),
        "K" => Ok(Code::KeyK),
        "L" => Ok(Code::KeyL),
        "M" => Ok(Code::KeyM),
        "N" => Ok(Code::KeyN),
        "O" => Ok(Code::KeyO),
        "P" => Ok(Code::KeyP),
        "Q" => Ok(Code::KeyQ),
        "R" => Ok(Code::KeyR),
        "S" => Ok(Code::KeyS),
        "T" => Ok(Code::KeyT),
        "U" => Ok(Code::KeyU),
        "V" => Ok(Code::KeyV),
        "W" => Ok(Code::KeyW),
        "X" => Ok(Code::KeyX),
        "Y" => Ok(Code::KeyY),
        "Z" => Ok(Code::KeyZ),
        "0" => Ok(Code::Digit0),
        "1" => Ok(Code::Digit1),
        "2" => Ok(Code::Digit2),
        "3" => Ok(Code::Digit3),
        "4" => Ok(Code::Digit4),
        "5" => Ok(Code::Digit5),
        "6" => Ok(Code::Digit6),
        "7" => Ok(Code::Digit7),
        "8" => Ok(Code::Digit8),
        "9" => Ok(Code::Digit9),
        "SPACE" => Ok(Code::Space),
        "ENTER" => Ok(Code::Enter),
        "TAB" => Ok(Code::Tab),
        "ESCAPE" | "ESC" => Ok(Code::Escape),
        "BACKSPACE" => Ok(Code::Backspace),
        "DELETE" => Ok(Code::Delete),
        "ARROWUP" | "UP" => Ok(Code::ArrowUp),
        "ARROWDOWN" | "DOWN" => Ok(Code::ArrowDown),
        "ARROWLEFT" | "LEFT" => Ok(Code::ArrowLeft),
        "ARROWRIGHT" | "RIGHT" => Ok(Code::ArrowRight),
        "HOME" => Ok(Code::Home),
        "END" => Ok(Code::End),
        "PAGEUP" => Ok(Code::PageUp),
        "PAGEDOWN" => Ok(Code::PageDown),
        "F1" => Ok(Code::F1),
        "F2" => Ok(Code::F2),
        "F3" => Ok(Code::F3),
        "F4" => Ok(Code::F4),
        "F5" => Ok(Code::F5),
        "F6" => Ok(Code::F6),
        "F7" => Ok(Code::F7),
        "F8" => Ok(Code::F8),
        "F9" => Ok(Code::F9),
        "F10" => Ok(Code::F10),
        "F11" => Ok(Code::F11),
        "F12" => Ok(Code::F12),
        "BACKQUOTE" | "`" => Ok(Code::Backquote),
        "MINUS" | "-" => Ok(Code::Minus),
        "EQUAL" | "=" => Ok(Code::Equal),
        "BRACKETLEFT" | "[" => Ok(Code::BracketLeft),
        "BRACKETRIGHT" | "]" => Ok(Code::BracketRight),
        "BACKSLASH" | "\\" => Ok(Code::Backslash),
        "SEMICOLON" | ";" => Ok(Code::Semicolon),
        "QUOTE" | "'" => Ok(Code::Quote),
        "COMMA" | "," => Ok(Code::Comma),
        "PERIOD" | "." => Ok(Code::Period),
        "SLASH" | "/" => Ok(Code::Slash),
        "INSERT" => Ok(Code::Insert),
        "PAUSE" => Ok(Code::Pause),
        "CAPSLOCK" => Ok(Code::CapsLock),
        "PRINTSCREEN" => Ok(Code::PrintScreen),
        "SCROLLLOCK" => Ok(Code::ScrollLock),
        "NUMPADADD" => Ok(Code::NumpadAdd),
        "NUMPADSUBTRACT" => Ok(Code::NumpadSubtract),
        "NUMPADMULTIPLY" => Ok(Code::NumpadMultiply),
        "NUMPADDIVIDE" => Ok(Code::NumpadDivide),
        "NUMPADDECIMAL" => Ok(Code::NumpadDecimal),
        _ => Err(format!("رمز مفتاح غير مدعوم: {}", key)),
    }
}

#[tauri::command]
pub fn register_custom_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<'_, ShortcutState>,
    event_name: String,
    ctrl: bool,
    shift: bool,
    alt: bool,
    key: String,
) -> Result<(), String> {
    let signature = format!("{}:{}:{}:{}", ctrl, shift, alt, key.to_uppercase());

    {
        let signatures = state.signatures.lock().unwrap();
        if signatures
            .get(&event_name)
            .is_some_and(|saved| saved == &signature)
        {
            return Ok(());
        }
    }

    let k = key.to_uppercase();
    let is_bypassed = (k == "SPACE" && !ctrl && !shift && !alt)
        || k == "CONTROL"
        || k == "CTRL"
        || k == "SHIFT"
        || k == "ALT";

    if is_bypassed {
        let mut map = state.shortcuts.lock().unwrap();
        if let Some(old_shortcut) = map.remove(&event_name) {
            let _ = app.global_shortcut().unregister(old_shortcut);
        }
        state.signatures.lock().unwrap().insert(event_name.clone(), signature);
        
        let mut bypassed = state.bypassed_keys.lock().unwrap();
        bypassed.insert(event_name, k);
        return Ok(());
    }

    // Otherwise register globally via Tauri global shortcut plugin
    let mut bypassed = state.bypassed_keys.lock().unwrap();
    bypassed.remove(&event_name);

    let mut modifiers = Modifiers::empty();
    if ctrl {
        modifiers.insert(Modifiers::CONTROL);
    }
    if shift {
        modifiers.insert(Modifiers::SHIFT);
    }
    if alt {
        modifiers.insert(Modifiers::ALT);
    }

    let code = shortcut_code(&key)?;
    let shortcut = Shortcut::new(Some(modifiers), code);

    let mut map = state.shortcuts.lock().unwrap();
    if let Some(old_shortcut) = map.remove(&event_name) {
        let _ = app.global_shortcut().unregister(old_shortcut);
    }
    state.signatures.lock().unwrap().remove(&event_name);

    // إلغاء تسجيل الاختصار الجديد أولاً كإجراء وقائي
    let _ = app.global_shortcut().unregister(shortcut);

    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| format!("فشل تسجيل الاختصار لدى نظام التشغيل: {}", e))?;

    map.insert(event_name.clone(), shortcut);
    state
        .signatures
        .lock()
        .unwrap()
        .insert(event_name, signature);
    Ok(())
}

#[tauri::command]
pub fn unregister_custom_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<'_, ShortcutState>,
    event_name: String,
) -> Result<(), String> {
    let mut map = state.shortcuts.lock().unwrap();
    if let Some(old_shortcut) = map.remove(&event_name) {
        let _ = app.global_shortcut().unregister(old_shortcut);
    }
    state.signatures.lock().unwrap().remove(&event_name);
    
    let mut bypassed = state.bypassed_keys.lock().unwrap();
    bypassed.remove(&event_name);
    Ok(())
}

#[cfg(target_os = "windows")]
enum KeyboardEvent {
    KeyDown(u32),
    KeyUp(u32),
}

#[cfg(target_os = "windows")]
static KEYBOARD_EVENT_SENDER: OnceLock<Sender<KeyboardEvent>> = OnceLock::new();

#[cfg(target_os = "windows")]
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    if code >= 0 {
        let msg_id = wparam.0 as u32;
        if msg_id == WM_KEYDOWN || msg_id == WM_KEYUP || msg_id == WM_SYSKEYDOWN || msg_id == WM_SYSKEYUP {
            let hook_struct = *(lparam.0 as *const KBDLLHOOKSTRUCT);
            let vk_code = hook_struct.vkCode;
            
            let event = if msg_id == WM_KEYDOWN || msg_id == WM_SYSKEYDOWN {
                KeyboardEvent::KeyDown(vk_code)
            } else {
                KeyboardEvent::KeyUp(vk_code)
            };
            
            if let Some(sender) = KEYBOARD_EVENT_SENDER.get() {
                let _ = sender.send(event);
            }
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn key_name_to_vk(key_name: &str) -> Option<u32> {
    match key_name {
        "CONTROL" | "CTRL" => Some(17),
        "SHIFT" => Some(16),
        "ALT" => Some(18),
        "SPACE" => Some(32),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
struct KeyState {
    is_down: bool,
    other_pressed: bool,
    timer_canceled: Option<Arc<AtomicBool>>,
    hold_triggered: Arc<AtomicBool>,
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

#[cfg(target_os = "windows")]
fn is_own_foreground(app: &tauri::AppHandle) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    let fg_hwnd = unsafe { GetForegroundWindow() };
    if is_own_window(fg_hwnd) {
        return true;
    }
    let fg_id = fg_hwnd.0 as isize;
    for label in ["main", "overlay"] {
        if let Some(w) = app.get_webview_window(label) {
            if let Ok(h) = w.hwnd() {
                if (h.0 as isize) == fg_id {
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn prepare_for_shortcut_recording(app: &tauri::AppHandle) {
    use crate::modules::selection::SelectionMonitorState;
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VK_MENU,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetAncestor, GetCursorPos, GetForegroundWindow, SetForegroundWindow,
        ShowWindow, WindowFromPoint, GA_ROOT, SW_RESTORE, SW_SHOW, IsIconic,
    };

    let fg_hwnd = unsafe { GetForegroundWindow() };
    let mut fg_id = fg_hwnd.0 as isize;

    let mut is_own = false;
    if fg_id != 0 {
        for label in ["main", "overlay"] {
            if let Some(w) = app.get_webview_window(label) {
                if let Ok(h) = w.hwnd() {
                    if h.0 == fg_hwnd.0 {
                        is_own = true;
                        break;
                    }
                }
            }
        }
    } else {
        is_own = true;
    }

    if is_own {
        let mut point = POINT::default();
        if unsafe { GetCursorPos(&mut point).is_ok() } {
            let hwnd = unsafe { WindowFromPoint(point) };
            if !hwnd.0.is_null() && !is_own_window(hwnd) {
                let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
                let target = if !root.0.is_null() { root } else { hwnd };
                if !is_own_window(target) {
                    fg_id = target.0 as isize;
                    is_own = false;
                }
            }
        }
    }

    if !is_own && fg_id != 0 {
        if let Some(state) = app.try_state::<SelectionMonitorState>() {
            if let Ok(mut target) = state.target_hwnd_handle().lock() {
                *target = Some(fg_id);
            }
            // إعلام capture_external_target بأن النافذة قد التُقطت
            state.mark_shortcut_captured();
        }
    }

    if let Some(w) = app.get_webview_window("main") {
        if !is_own_foreground(app) {
            if let Ok(hwnd) = w.hwnd() {
                unsafe {
                    // حيلة Alt key لتجاوز قيود Windows في سرقة التركيز — فقط للتطبيقات الخارجية
                    keybd_event(VK_MENU.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
                    keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
                    if IsIconic(hwnd).as_bool() {
                        let _ = ShowWindow(hwnd, SW_RESTORE);
                    } else {
                        let _ = ShowWindow(hwnd, SW_SHOW);
                    }
                    let _ = BringWindowToTop(hwnd);
                    let _ = SetForegroundWindow(hwnd);
                }
            }
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn prepare_for_shortcut_recording(_app: &tauri::AppHandle) {}

#[cfg(target_os = "windows")]
pub fn start_keyboard_monitor(app: tauri::AppHandle) {
    let (tx, rx) = channel::<KeyboardEvent>();
    let _ = KEYBOARD_EVENT_SENDER.set(tx);

    std::thread::spawn(move || unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL,
        };
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), None, 0)
            .expect("Failed to set low-level keyboard hook");

        let mut msg = windows::Win32::UI::WindowsAndMessaging::MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = windows::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
            windows::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
        }

        let _ = UnhookWindowsHookEx(hook);
    });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut key_states: HashMap<u32, KeyState> = HashMap::new();
        key_states.insert(17, KeyState { is_down: false, other_pressed: false, timer_canceled: None, hold_triggered: Arc::new(AtomicBool::new(false)) });
        key_states.insert(16, KeyState { is_down: false, other_pressed: false, timer_canceled: None, hold_triggered: Arc::new(AtomicBool::new(false)) });
        key_states.insert(18, KeyState { is_down: false, other_pressed: false, timer_canceled: None, hold_triggered: Arc::new(AtomicBool::new(false)) });
        key_states.insert(32, KeyState { is_down: false, other_pressed: false, timer_canceled: None, hold_triggered: Arc::new(AtomicBool::new(false)) });

        while let Ok(event) = rx.recv() {
            let state = app_clone.state::<ShortcutState>();
            
            match event {
                KeyboardEvent::KeyDown(raw_vk) => {
                    let vk = match raw_vk {
                        160 | 161 => 16,
                        162 | 163 => 17,
                        164 | 165 => 18,
                        _ => raw_vk,
                    };

                    let is_bypassed_active = {
                        let bypassed = state.bypassed_keys.lock().unwrap();
                        bypassed.values().any(|name| key_name_to_vk(name) == Some(vk))
                    };

                    if is_bypassed_active {
                        if let Some(s) = key_states.get_mut(&vk) {
                            if !s.is_down {
                                s.is_down = true;
                                s.other_pressed = false;
                                s.hold_triggered.store(false, Ordering::SeqCst);
                                if let Some(ref c) = s.timer_canceled {
                                    c.store(true, Ordering::SeqCst);
                                }
                                let canceled = Arc::new(AtomicBool::new(false));
                                s.timer_canceled = Some(canceled.clone());
                                let hold_flag = s.hold_triggered.clone();
                                let app_emit = app_clone.clone();
                                
                                let event_name = {
                                    let bypassed = state.bypassed_keys.lock().unwrap();
                                    bypassed.iter()
                                        .find(|(_, name)| key_name_to_vk(name) == Some(vk))
                                        .map(|(evt, _)| evt.clone())
                                        .unwrap_or_default()
                                };
                                
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(650));
                                    if !canceled.load(Ordering::SeqCst) {
                                        hold_flag.store(true, Ordering::SeqCst);
                                        if !is_own_foreground(&app_emit) {
                                            handle_shortcut_trigger(&app_emit, &event_name, "pressed");
                                        }
                                    }
                                });
                            }
                        }
                    } else {
                        // Cancel any pending hold timers
                        for s in key_states.values_mut() {
                            if s.is_down {
                                s.other_pressed = true;
                                if let Some(ref c) = s.timer_canceled {
                                    c.store(true, Ordering::SeqCst);
                                }
                            }
                        }
                    }
                }
                KeyboardEvent::KeyUp(raw_vk) => {
                    let vk = match raw_vk {
                        160 | 161 => 16,
                        162 | 163 => 17,
                        164 | 165 => 18,
                        _ => raw_vk,
                    };

                    if let Some(s) = key_states.get_mut(&vk) {
                        if s.is_down {
                            s.is_down = false;
                            if let Some(ref c) = s.timer_canceled {
                                c.store(true, Ordering::SeqCst);
                            }
                            
                            let event_name = {
                                let bypassed = state.bypassed_keys.lock().unwrap();
                                bypassed.iter()
                                    .find(|(_, name)| key_name_to_vk(name) == Some(vk))
                                    .map(|(evt, _)| evt.clone())
                                    .unwrap_or_default()
                            };

                            if !event_name.is_empty() {
                                if s.hold_triggered.load(Ordering::SeqCst) {
                                    if !is_own_foreground(&app_clone) {
                                        handle_shortcut_trigger(&app_clone, &event_name, "released");
                                    }
                                } else if !s.other_pressed {
                                    if !is_own_foreground(&app_clone) {
                                        handle_shortcut_trigger(&app_clone, &event_name, "pressed");
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_keyboard_monitor(_app: tauri::AppHandle) {}

fn is_background_recording_active(app: &tauri::AppHandle) -> bool {
    app.try_state::<crate::modules::audio::recorder::RecorderState>()
        .and_then(|state| state.inner().recorder.lock().ok())
        .is_some_and(|guard| guard.is_some())
}

fn should_use_direct_dictation(
    _app: &tauri::AppHandle,
    config: &crate::modules::audio::config::BackgroundConfig,
) -> bool {
    if !config.provider.is_empty() && config.provider != "WebSpeech" {
        return true;
    }
    if let Ok(keys) = crate::modules::ai::security::load_all_secure_api_keys() {
        return keys.values().any(|k| !k.trim().is_empty());
    }
    false
}

async fn handle_speech_direct_shortcut(app: tauri::AppHandle, state_str: &str, behavior: &str) {
    match behavior {
        "disabled" => {}
        "hold" => {
            if state_str == "pressed" {
                if !is_background_recording_active(&app) {
                    let _ = start_direct_dictation(app).await;
                }
            } else if state_str == "released" && is_background_recording_active(&app) {
                let _ = stop_direct_dictation(app).await;
            }
        }
        "double" => {
            if state_str != "pressed" {
                return;
            }
            // أثناء التسجيل: نقرة واحدة للإيقاف. قبل البدء: نقرتان سريعتان للبدء.
            if is_background_recording_active(&app) {
                let _ = stop_direct_dictation(app.clone()).await;
                if let Some(state) = app.try_state::<ShortcutState>() {
                    let mut rt = state.speech_runtime.lock().unwrap();
                    rt.last_press = None;
                }
                return;
            }
            let should_start = {
                let state = app.state::<ShortcutState>();
                let mut rt = state.speech_runtime.lock().unwrap();
                let now = std::time::Instant::now();
                let start = rt
                    .last_press
                    .map(|t| now.duration_since(t) < std::time::Duration::from_millis(350))
                    .unwrap_or(false);
                rt.last_press = Some(now);
                start
            };
            if should_start {
                let _ = start_direct_dictation(app).await;
            }
        }
        "long_press_start" => {
            if state_str == "pressed" {
                if is_background_recording_active(&app) {
                    let _ = stop_direct_dictation(app).await;
                    return;
                }
                let cancel = Arc::new(AtomicBool::new(false));
                {
                    let state = app.state::<ShortcutState>();
                    let mut rt = state.speech_runtime.lock().unwrap();
                    if let Some(old) = rt.long_press_cancel.take() {
                        old.store(true, Ordering::SeqCst);
                    }
                    rt.long_press_cancel = Some(cancel.clone());
                }
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(1200)).await;
                    if !cancel.load(Ordering::SeqCst) && !is_background_recording_active(&app_clone) {
                        let _ = start_direct_dictation(app_clone).await;
                    }
                });
            } else if state_str == "released" {
                let state = app.state::<ShortcutState>();
                let mut rt = state.speech_runtime.lock().unwrap();
                if let Some(cancel) = rt.long_press_cancel.take() {
                    cancel.store(true, Ordering::SeqCst);
                }
            }
        }
        _ => {
            if state_str == "pressed" {
                let _ = toggle_direct_dictation(app).await;
            }
        }
    }
}

pub(crate) fn handle_shortcut_trigger(app: &tauri::AppHandle, event_name: &str, state_str: &str) {
    let app_clone = app.clone();
    let event_name_str = event_name.to_string();
    let state_string = state_str.to_string();

    tauri::async_runtime::spawn(async move {
        if event_name_str == "speech-to-text" {
            let config = crate::modules::audio::config::load_config(&app_clone);

            // اختصار الصوت: تسجيل مباشر ثم لصق في النافذة النشطة
            if should_use_direct_dictation(&app_clone, &config) {
                if config.stt_behavior != "disabled" {
                    handle_speech_direct_shortcut(
                        app_clone,
                        &state_string,
                        config.stt_behavior.as_str(),
                    )
                    .await;
                }
                return;
            }

            if state_string == "pressed" {
                prepare_for_shortcut_recording(&app_clone);
            }

            let payload = format!(
                r#"{{"action": "{}", "state": "{}"}}"#,
                event_name_str, state_string
            );
            let _ = app_clone.emit("global-shortcut-triggered", payload);
            return;
        }

        if state_string == "pressed" {
            prepare_for_shortcut_recording(&app_clone);
        }
        let payload = format!(
            r#"{{"action": "{}", "state": "{}"}}"#,
            event_name_str, state_string
        );
        let _ = app_clone.emit("global-shortcut-triggered", payload);
    });
}

#[tauri::command]
pub async fn direct_dictation_toggle(app: tauri::AppHandle) -> Result<(), String> {
    toggle_direct_dictation(app).await
}

#[tauri::command]
pub fn direct_dictation_is_active(app: tauri::AppHandle) -> bool {
    is_background_recording_active(&app)
}

async fn toggle_direct_dictation(app: tauri::AppHandle) -> Result<(), String> {
    if is_background_recording_active(&app) {
        stop_direct_dictation(app).await
    } else {
        start_direct_dictation(app).await
    }
}

async fn start_direct_dictation(app: tauri::AppHandle) -> Result<(), String> {
    if is_background_recording_active(&app) {
        return Ok(());
    }

    let paste_in_app = is_own_foreground(&app);

    // تنبيه فوري قبل أي تهيئة أخرى
    play_beep(800, 150);
    if !paste_in_app {
        crate::modules::selection::overlay::show_hud_notification(&app, "🎙️", "بدأ التسجيل...");
    }

    let state = app.state::<crate::modules::audio::recorder::RecorderState>();

    #[cfg(target_os = "windows")]
    {
        let captured_hwnd = crate::modules::selection::resolve_paste_target_hwnd(&app);
        let mut hwnd_lock = state.inner().target_hwnd.lock().map_err(|e| e.to_string())?;
        *hwnd_lock = captured_hwnd;
        let mut in_app_lock = state.inner().paste_in_app.lock().map_err(|e| e.to_string())?;
        *in_app_lock = paste_in_app
            || captured_hwnd
                .map(|id| crate::modules::selection::is_app_main_hwnd(&app, id))
                .unwrap_or(true);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut in_app_lock = state.inner().paste_in_app.lock().map_err(|e| e.to_string())?;
        *in_app_lock = true;
    }

    match crate::modules::audio::recorder::start_recording() {
        Ok(recorder) => {
            let mut recorder_lock = state.inner().recorder.lock().map_err(|e| e.to_string())?;
            *recorder_lock = Some(recorder);
            let _ = app.emit("background-recording-started", ());
        }
        Err(e) => {
            crate::modules::selection::overlay::show_hud_notification(
                &app,
                "❌",
                &format!("فشل بدء التسجيل: {}", e),
            );
            play_beep(400, 200);
        }
    }

    Ok(())
}

async fn stop_direct_dictation(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<crate::modules::audio::recorder::RecorderState>();

    let active_recorder = {
        let mut recorder_lock = state.inner().recorder.lock().map_err(|e| e.to_string())?;
        recorder_lock.take()
    };

    let Some(recorder) = active_recorder else {
        return Ok(());
    };

    let saved_target_hwnd = {
        let mut hwnd_lock = state
            .inner()
            .target_hwnd
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        hwnd_lock.take()
    };

    let paste_in_app = {
        let mut in_app_lock = state
            .inner()
            .paste_in_app
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let value = *in_app_lock;
        *in_app_lock = false;
        value
    };

    #[cfg(target_os = "windows")]
    let in_app_session = paste_in_app || is_own_foreground(&app);
    #[cfg(not(target_os = "windows"))]
    let in_app_session = paste_in_app;

    let _ = app.emit("background-recording-stopped", ());
    if !in_app_session {
        crate::modules::selection::overlay::show_hud_notification(&app, "⏳", "جاري التحويل...");
    }
    play_beep(1000, 100);

    let run_transcription = async {
        let audio_bytes = recorder
            .stop()
            .map_err(|e| format!("فشل إيقاف التسجيل: {}", e))?;
        let audio_base64 =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &audio_bytes);

        let config = crate::modules::audio::config::load_config(&app);

        if audio_bytes.len() < 2_000 {
            return Err("التسجيل قصير جداً. تحدث لفترة أطول ثم أوقف التسجيل.".to_string());
        }

        let (text, prompt_tokens, completion_tokens, used_creds) =
            crate::modules::ai::transcription::transcribe_stt_with_fallbacks(
                &config.provider,
                &config.model,
                &audio_base64,
                &config.language,
                "audio/wav",
                "audio.wav",
            )
            .await?;

        if text.trim().is_empty() {
            return Err("لم يتم التعرف على أي كلام.".to_string());
        }

        write_dictation_text(&app, text.clone(), saved_target_hwnd, in_app_session)
            .await
            .map_err(|e| format!("فشل إلصاق النص: {}", e))?;

        let completion_chars = text.chars().count() as u32;
        let completion_words = text.split_whitespace().count() as u32;
        crate::modules::usage_stats::record(
            &app,
            crate::modules::usage_stats::RecordPayload {
                provider: &used_creds.provider,
                model: &used_creds.model,
                action: "transcribe",
                prompt_tokens,
                completion_tokens,
                prompt_chars: 0,
                completion_chars,
                prompt_words: 0,
                completion_words,
            },
        );

        Ok(())
    };

    match run_transcription.await {
        Ok(_) => {
            if !in_app_session {
                crate::modules::selection::overlay::show_hud_notification(&app, "🟢", "تم إلصاق النص.");
            }
            play_beep(1200, 150);
            let _ = app.emit("background-processing-finished", ());
        }
        Err(err_msg) => {
            let icon = if err_msg.contains("مفتاح API") || err_msg.contains("API") {
                "🔑"
            } else if err_msg.contains("كلام") {
                "🎙️"
            } else {
                "❌"
            };
            if !in_app_session {
                crate::modules::selection::overlay::show_hud_notification(&app, icon, &err_msg);
            }
            let _ = app.emit("background-processing-finished", ());
        }
    }

    release_stuck_modifiers();

    Ok(())
}

#[allow(dead_code)]
async fn handle_background_recording_toggle(app: tauri::AppHandle) -> Result<(), String> {
    toggle_direct_dictation(app).await
}

#[cfg(target_os = "windows")]
fn gentle_ensure_main_visible(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        if let Ok(hwnd) = w.hwnd() {
            use windows::Win32::UI::WindowsAndMessaging::{IsIconic, ShowWindow, SW_RESTORE};
            unsafe {
                if IsIconic(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
async fn write_dictation_text(
    app: &tauri::AppHandle,
    text: String,
    target_hwnd: Option<isize>,
    paste_in_app: bool,
) -> Result<(), String> {
    let paste_hwnd = target_hwnd.or_else(|| crate::modules::selection::resolve_paste_target_hwnd(app));
    let in_app = paste_in_app
        || is_own_foreground(app)
        || paste_hwnd
            .map(|id| crate::modules::selection::is_app_window_hwnd(app, id))
            .unwrap_or(true);

    if in_app {
        let _ = app.emit("direct-dictation-text", text);
        gentle_ensure_main_visible(app);
        return Ok(());
    }

    if let Some(hwnd_id) = paste_hwnd {
        focus_hwnd(hwnd_id).await;
    }

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())?;

    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    release_stuck_modifiers();

    let mut guard = KeyboardGuard::new(Enigo::new(&Settings::default()).map_err(|e| e.to_string())?);
    guard.press(Key::Control)?;
    guard.click(Key::Unicode('v'))?;
    release_stuck_modifiers();

    Ok(())
}

#[cfg(target_os = "windows")]
async fn write_to_system_silently(
    app: &tauri::AppHandle,
    text: String,
    target_hwnd: Option<isize>,
) -> Result<(), String> {
    write_dictation_text(app, text, target_hwnd, is_own_foreground(app)).await
}

#[cfg(not(target_os = "windows"))]
async fn write_to_system_silently(_app: &tauri::AppHandle, _text: String, _target_hwnd: Option<isize>) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn play_beep(freq: u32, duration: u32) {
    extern "system" {
        fn Beep(dwFreq: u32, dwDuration: u32) -> i32;
    }
    unsafe {
        Beep(freq, duration);
    }
}

#[cfg(not(target_os = "windows"))]
fn play_beep(_freq: u32, _duration: u32) {}

#[allow(dead_code)]
fn show_notification(app: &tauri::AppHandle, _title: &str, body: &str) {
    crate::modules::selection::overlay::show_hud_notification(app, "ℹ️", body);
}
