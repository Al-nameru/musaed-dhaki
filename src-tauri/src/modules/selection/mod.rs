pub mod overlay;

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

use crate::release_stuck_modifiers;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{channel, Sender},
    Arc, Mutex, OnceLock,
};
use tauri::Manager;

pub struct SelectionMonitorState {
    enabled: Arc<AtomicBool>,
    target_hwnd: Arc<Mutex<Option<isize>>>,
    /// يُشير إلى أن الاختصار قد التقط النافذة الخارجية وحفظها في target_hwnd
    shortcut_captured: Arc<AtomicBool>,
}

impl SelectionMonitorState {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(enabled)),
            target_hwnd: Arc::new(Mutex::new(None)),
            shortcut_captured: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn enabled_handle(&self) -> Arc<AtomicBool> {
        self.enabled.clone()
    }

    pub fn target_hwnd_handle(&self) -> Arc<Mutex<Option<isize>>> {
        self.target_hwnd.clone()
    }

    pub fn last_target_hwnd(&self) -> Option<isize> {
        self.target_hwnd.lock().ok().and_then(|guard| *guard)
    }

    /// تحديد أن الاختصار التقط النافذة الخارجية
    pub fn mark_shortcut_captured(&self) {
        self.shortcut_captured.store(true, Ordering::SeqCst);
    }

    /// قراءة وإعادة تعيين علَم الالتقاط. يُرجع true مرة واحدة ثم يُعيد false.
    pub fn take_shortcut_captured(&self) -> bool {
        self.shortcut_captured.swap(false, Ordering::SeqCst)
    }
}

fn copy_selected_text_internal(marker: Option<&str>) -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let _ = enigo.key(Key::Meta, Direction::Press);
        let _ = enigo.key(Key::Unicode('c'), Direction::Click);
        let _ = enigo.key(Key::Meta, Direction::Release);
    }
    release_stuck_modifiers();
    #[cfg(not(target_os = "macos"))]
    {
        let _ = enigo.key(Key::Control, Direction::Press);
        let _ = enigo.key(Key::Unicode('c'), Direction::Click);
        let _ = enigo.key(Key::Control, Direction::Release);
    }
    release_stuck_modifiers();

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_millis(150);
    while start.elapsed() < timeout {
        if let Ok(mut clipboard) = Clipboard::new() {
            if let Ok(text) = clipboard.get_text() {
                if let Some(m) = marker {
                    if text != m {
                        return Ok(text);
                    }
                } else {
                    return Ok(text);
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let text = clipboard.get_text().map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
pub fn copy_selected_text() -> Result<String, String> {
    let previous_text = Clipboard::new().ok().and_then(|mut c| c.get_text().ok());
    copy_selected_text_internal(previous_text.as_deref())
}

fn copy_selected_text_preserving_clipboard() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let previous_text = clipboard.get_text().ok();
    let marker = format!(
        "__SMART_ASSISTANT_SELECTION_MARKER_{}__",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    clipboard
        .set_text(marker.clone())
        .map_err(|e| e.to_string())?;
    drop(clipboard);

    let text = copy_selected_text_internal(Some(&marker))?;

    if let Ok(mut restore_clipboard) = Clipboard::new() {
        if let Some(previous) = previous_text {
            let _ = restore_clipboard.set_text(previous);
        } else {
            let _ = restore_clipboard.set_text(String::new());
        }
    }

    if text == marker {
        return Err("لا يوجد نص محدد حالياً".to_string());
    }

    Ok(text)
}

#[tauri::command]
pub fn set_selection_monitor_enabled(
    state: tauri::State<'_, SelectionMonitorState>,
    enabled: bool,
) -> Result<(), String> {
    state.enabled.store(enabled, Ordering::SeqCst);
    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) fn is_own_app_window(app: &tauri::AppHandle, hwnd: windows::Win32::Foundation::HWND) -> bool {
    if hwnd.0.is_null() || is_own_window(hwnd) {
        return true;
    }
    for label in ["main", "overlay"] {
        if let Some(w) = app.get_webview_window(label) {
            if let Ok(h) = w.hwnd() {
                if h.0 == hwnd.0 {
                    return true;
                }
            }
        }
    }
    false
}

/// يحدد HWND النافذة الخارجية النشطة (النافذة الأمامية أو تحت المؤشر).
#[cfg(target_os = "windows")]
pub fn resolve_external_target_hwnd(app: &tauri::AppHandle) -> Option<isize> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, GetCursorPos, GetForegroundWindow, WindowFromPoint, GA_ROOT,
    };

    let fg_hwnd = unsafe { GetForegroundWindow() };
    let mut target_id = fg_hwnd.0 as isize;
    let mut is_own = target_id == 0 || is_own_app_window(app, fg_hwnd);

    if is_own {
        let mut point = POINT::default();
        if unsafe { GetCursorPos(&mut point).is_ok() } {
            let hwnd = unsafe { WindowFromPoint(point) };
            if !hwnd.0.is_null() && !is_own_app_window(app, hwnd) {
                let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
                let target = if !root.0.is_null() { root } else { hwnd };
                if !is_own_app_window(app, target) {
                    target_id = target.0 as isize;
                    is_own = false;
                }
            }
        }
    }

    if is_own || target_id == 0 {
        None
    } else {
        Some(target_id)
    }
}

/// نافذة اللصق: خارجية إن وُجدت، وإلا نافذة التطبيق الرئيسية.
#[cfg(target_os = "windows")]
pub fn resolve_paste_target_hwnd(app: &tauri::AppHandle) -> Option<isize> {
    if let Some(external) = resolve_external_target_hwnd(app) {
        return Some(external);
    }
    app.get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize)
}

#[cfg(target_os = "windows")]
pub fn is_app_main_hwnd(app: &tauri::AppHandle, hwnd_id: isize) -> bool {
    app.get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize == hwnd_id)
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
pub fn is_app_overlay_hwnd(app: &tauri::AppHandle, hwnd_id: isize) -> bool {
    app.get_webview_window("overlay")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize == hwnd_id)
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
pub fn is_app_overlay_hwnd(_app: &tauri::AppHandle, _hwnd_id: isize) -> bool {
    false
}

pub fn is_app_window_hwnd(app: &tauri::AppHandle, hwnd_id: isize) -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        return is_own_app_window(app, HWND(hwnd_id as _));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = hwnd_id;
        is_app_main_hwnd(app, hwnd_id) || is_app_overlay_hwnd(app, hwnd_id)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_paste_target_hwnd(_app: &tauri::AppHandle) -> Option<isize> {
    None
}

#[cfg(not(target_os = "windows"))]
pub fn is_app_main_hwnd(_app: &tauri::AppHandle, _hwnd_id: isize) -> bool {
    false
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn capture_external_target(
    app: tauri::AppHandle,
    state: tauri::State<'_, SelectionMonitorState>,
) -> Result<bool, String> {
    if state.take_shortcut_captured() {
        return Ok(state.last_target_hwnd().is_some());
    }

    if let Some(fg_id) = resolve_external_target_hwnd(&app) {
        if let Ok(mut target) = state.target_hwnd.lock() {
            *target = Some(fg_id);
        }
        return Ok(true);
    }

    Ok(state.last_target_hwnd().is_some())
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_external_target_hwnd(_app: &tauri::AppHandle) -> Option<isize> {
    None
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn capture_external_target(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, SelectionMonitorState>,
) -> Result<bool, String> {
    Ok(false)
}

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

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

fn is_own_foreground(app: &tauri::AppHandle) -> bool {
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

fn is_cursor_over_own_process(px: i32, py: i32) -> bool {
    let hwnd = unsafe {
        windows::Win32::UI::WindowsAndMessaging::WindowFromPoint(
            windows::Win32::Foundation::POINT { x: px, y: py },
        )
    };
    is_own_window(hwnd)
}

#[cfg(target_os = "windows")]
fn cursor_inside_overlay(app: &tauri::AppHandle, px: i32, py: i32) -> bool {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if overlay.is_visible().unwrap_or(false) {
            if let (Ok(pos), Ok(size)) = (overlay.outer_position(), overlay.outer_size()) {
                let right = pos.x + size.width as i32;
                let bottom = pos.y + size.height as i32;
                return px >= pos.x && px <= right && py >= pos.y && py <= bottom;
            }
        }
    }
    false
}

#[cfg(target_os = "windows")]
#[cfg(target_os = "windows")]
enum MouseEvent {
    MouseDown(i32, i32),
    MouseUp(i32, i32),
}

#[cfg(target_os = "windows")]
static MOUSE_EVENT_SENDER: OnceLock<Sender<MouseEvent>> = OnceLock::new();

#[cfg(target_os = "windows")]
unsafe extern "system" fn mouse_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, MSLLHOOKSTRUCT, WM_LBUTTONDOWN, WM_LBUTTONUP,
    };

    if code >= 0 {
        let msg_id = wparam.0 as u32;
        if msg_id == WM_LBUTTONDOWN || msg_id == WM_LBUTTONUP {
            let hook_struct = *(lparam.0 as *const MSLLHOOKSTRUCT);
            let x = hook_struct.pt.x;
            let y = hook_struct.pt.y;
            let event = if msg_id == WM_LBUTTONDOWN {
                MouseEvent::MouseDown(x, y)
            } else {
                MouseEvent::MouseUp(x, y)
            };
            if let Some(sender) = MOUSE_EVENT_SENDER.get() {
                let _ = sender.send(event);
            }
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn handle_mouse_down_at(app: &tauri::AppHandle, px: i32, py: i32) -> (i32, i32) {
    if !cursor_inside_overlay(app, px, py) {
        let _ = overlay::hide_selection_overlay(app.clone());
    }
    (px, py)
}

#[cfg(target_os = "windows")]
fn handle_mouse_up_at(
    app: &tauri::AppHandle,
    release_pos: (i32, i32),
    press_pos: (i32, i32),
    last_text: &mut String,
    last_emit_at: &mut std::time::Instant,
    target_hwnd: &Arc<Mutex<Option<isize>>>,
) -> bool {
    let (rx, ry) = release_pos;
    let (press_x, press_y) = press_pos;

    if cursor_inside_overlay(app, rx, ry)
        || is_own_foreground(app)
        || is_cursor_over_own_process(rx, ry)
    {
        return false;
    }

    std::thread::sleep(std::time::Duration::from_millis(160));

    if let Ok(text) = copy_selected_text_preserving_clipboard() {
        let clean = text.trim().to_string();
        if clean.chars().count() >= 2
            && (clean != *last_text || last_emit_at.elapsed() > std::time::Duration::from_secs(1))
        {
            *last_text = clean.clone();
            *last_emit_at = std::time::Instant::now();
            let center_x = (press_x + rx) / 2;
            let top_y = press_y.min(ry);
            let bottom_y = press_y.max(ry);
            let fg_id = unsafe { GetForegroundWindow().0 as isize };
            if fg_id != 0 {
                if let Ok(mut target) = target_hwnd.lock() {
                    *target = Some(fg_id);
                }
            }
            overlay::show_overlay_window(app, &clean, center_x, top_y, bottom_y);
        }
    }
    true
}

#[cfg(target_os = "windows")]
pub fn start_selection_monitor(
    app: tauri::AppHandle,
    enabled: Arc<AtomicBool>,
    target_hwnd: Arc<Mutex<Option<isize>>>,
) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WH_MOUSE_LL,
    };

    let (tx, rx) = channel::<MouseEvent>();
    let _ = MOUSE_EVENT_SENDER.set(tx);

    std::thread::spawn(move || unsafe {
        let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), None, 0)
            .expect("Failed to set low-level mouse hook");

        let mut msg = windows::Win32::UI::WindowsAndMessaging::MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = windows::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
            windows::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
        }

        let _ = UnhookWindowsHookEx(hook);
    });

    std::thread::spawn(move || {
        let mut last_text = String::new();
        let mut last_emit_at = std::time::Instant::now() - std::time::Duration::from_secs(2);
        let (mut press_x, mut press_y) = (0i32, 0i32);
        let mut was_down = false;

        while let Ok(event) = rx.recv() {
            match event {
                MouseEvent::MouseDown(x, y) => {
                    if !was_down {
                        let (px, py) = handle_mouse_down_at(&app, x, y);
                        press_x = px;
                        press_y = py;
                        was_down = true;
                    }
                }
                MouseEvent::MouseUp(x, y) => {
                    if was_down {
                        was_down = false;
                        if enabled.load(Ordering::SeqCst) {
                            let _ = handle_mouse_up_at(
                                &app,
                                (x, y),
                                (press_x, press_y),
                                &mut last_text,
                                &mut last_emit_at,
                                &target_hwnd,
                            );
                        }
                    }
                }
            }
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_selection_monitor(
    _app: tauri::AppHandle,
    _enabled: Arc<AtomicBool>,
    _target_hwnd: Arc<Mutex<Option<isize>>>,
) {
}
