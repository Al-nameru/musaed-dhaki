use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub static OVERLAY_SHOW_TOKEN: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Clone)]
pub struct OverlayActionPayload {
    pub action: String,
    pub text: String,
}

pub(crate) fn perform_hide(overlay: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
        if let Ok(h) = overlay.hwnd() {
            unsafe {
                let _ = ShowWindow(windows::Win32::Foundation::HWND(h.0 as _), SW_HIDE);
            }
        }
    }
    let _ = overlay.hide();
}

#[tauri::command]
pub fn hide_selection_overlay(app: tauri::AppHandle) -> Result<(), String> {
    OVERLAY_SHOW_TOKEN.fetch_add(1, Ordering::SeqCst);
    if let Some(overlay) = app.get_webview_window("overlay") {
        perform_hide(&overlay);
    }
    Ok(())
}

#[tauri::command]
pub fn run_overlay_action(
    app: tauri::AppHandle,
    action: String,
    text: String,
) -> Result<(), String> {
    OVERLAY_SHOW_TOKEN.fetch_add(1, Ordering::SeqCst);
    if let Some(overlay) = app.get_webview_window("overlay") {
        perform_hide(&overlay);
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    let _ = app.emit("overlay-action", OverlayActionPayload { action, text });
    Ok(())
}

pub fn overlay_placement(w: i32, h: i32, center_x: i32, top_y: i32, bottom_y: i32) -> (i32, i32) {
    let left = (center_x - w / 2).max(8);
    let above = top_y - h - 6;
    let top = if above < 8 { bottom_y + 10 } else { above };
    (left, top.max(8))
}

pub fn schedule_overlay_auto_hide(app: tauri::AppHandle, token: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(5));
        if OVERLAY_SHOW_TOKEN.load(Ordering::SeqCst) == token {
            if let Some(overlay) = app.get_webview_window("overlay") {
                perform_hide(&overlay);
            }
        }
    });
}

#[cfg(target_os = "windows")]
pub fn show_overlay_window(
    app: &tauri::AppHandle,
    text: &str,
    center_x: i32,
    top_y: i32,
    bottom_y: i32,
) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOSIZE, SWP_SHOWWINDOW,
    };
    if let Some(overlay) = app.get_webview_window("overlay") {
        let token = OVERLAY_SHOW_TOKEN.fetch_add(1, Ordering::SeqCst) + 1;
        let _ = app.emit("selection-overlay-show", text.to_string());
        let size = overlay
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(280, 56));
        let (left, top) = overlay_placement(
            size.width as i32,
            size.height as i32,
            center_x,
            top_y,
            bottom_y,
        );
        if let Ok(h) = overlay.hwnd() {
            let hwnd = HWND(h.0 as _);
            unsafe {
                let _ = SetWindowPos(
                    hwnd,
                    Some(HWND_TOPMOST),
                    left,
                    top,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOSIZE | SWP_SHOWWINDOW,
                );
            }
        }
        schedule_overlay_auto_hide(app.clone(), token);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn show_overlay_window(
    app: &tauri::AppHandle,
    text: &str,
    center_x: i32,
    top_y: i32,
    bottom_y: i32,
) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let token = OVERLAY_SHOW_TOKEN.fetch_add(1, Ordering::SeqCst) + 1;
        let _ = app.emit("selection-overlay-show", text.to_string());
        let size = overlay
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(280, 56));
        let (left, top) = overlay_placement(
            size.width as i32,
            size.height as i32,
            center_x,
            top_y,
            bottom_y,
        );
        let _ = overlay.set_position(tauri::PhysicalPosition::new(left, top));
        let _ = overlay.show();
        let _ = overlay.set_always_on_top(true);
        schedule_overlay_auto_hide(app.clone(), token);
    }
}

pub fn create_overlay_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    let overlay = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("")
        .inner_size(250.0, 56.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .visible(false)
        .build()?;

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        };
        if let Ok(h) = overlay.hwnd() {
            let hwnd = HWND(h.0 as _);
            unsafe {
                let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                SetWindowLongPtrW(
                    hwnd,
                    GWL_EXSTYLE,
                    ex | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize,
                );
            }
        }
    }

    let _ = overlay;
    Ok(())
}

#[cfg(target_os = "windows")]
fn is_app_in_foreground(app: &tauri::AppHandle) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    let fg = unsafe { GetForegroundWindow() };
    super::is_own_app_window(app, fg)
}

#[cfg(not(target_os = "windows"))]
fn is_app_in_foreground(_app: &tauri::AppHandle) -> bool {
    false
}

pub fn show_hud_notification(app: &tauri::AppHandle, icon: &str, text: &str) {
    let payload = serde_json::json!({
        "icon": icon,
        "text": text,
    });
    let _ = app.emit("show-status-notification", payload);

    // داخل التطبيق: لا نعرض نافذة الـ overlay حتى لا تسرق التركيز أو تُخفي النافذة الرئيسية
    if is_app_in_foreground(app) {
        return;
    }

    if let Some(overlay) = app.get_webview_window("overlay") {
        let token = OVERLAY_SHOW_TOKEN.fetch_add(1, Ordering::SeqCst) + 1;

        if let Ok(Some(monitor)) = overlay.primary_monitor() {
            let monitor_size = monitor.size();
            let monitor_pos = monitor.position();
            let w = 340;
            let h = 60;
            let x = monitor_pos.x + (monitor_size.width as i32 - w) / 2;
            let y = monitor_pos.y + 40;

            #[cfg(target_os = "windows")]
            {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOSIZE, SWP_SHOWWINDOW,
                };
                if let Ok(h_window) = overlay.hwnd() {
                    let hwnd = HWND(h_window.0 as _);
                    unsafe {
                        let _ = SetWindowPos(
                            hwnd,
                            Some(HWND_TOPMOST),
                            x,
                            y,
                            w,
                            h,
                            SWP_NOACTIVATE | SWP_NOSIZE | SWP_SHOWWINDOW,
                        );
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = overlay.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
                let _ = overlay.set_position(tauri::PhysicalPosition::new(x, y));
                let _ = overlay.show();
                let _ = overlay.set_always_on_top(true);
            }
        }
        schedule_overlay_auto_hide(app.clone(), token);
    }
}
