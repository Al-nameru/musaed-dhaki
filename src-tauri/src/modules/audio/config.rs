use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ShortcutDef {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub key: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackgroundConfig {
    pub provider: String,
    pub model: String,
    pub language: String,
    pub active: bool,
    pub stt_shortcut: ShortcutDef,
    pub text_shortcut: ShortcutDef,
    pub stt_behavior: String,
    pub text_behavior: String,
}

impl Default for BackgroundConfig {
    fn default() -> Self {
        Self {
            provider: "Gemini".to_string(),
            model: "gemini-2.5-flash".to_string(),
            language: "auto".to_string(),
            active: false,
            stt_shortcut: ShortcutDef {
                ctrl: true,
                shift: true,
                alt: false,
                key: "1".to_string(),
            },
            text_shortcut: ShortcutDef {
                ctrl: true,
                shift: true,
                alt: false,
                key: "2".to_string(),
            },
            stt_behavior: "toggle".to_string(),
            text_behavior: "single".to_string(),
        }
    }
}

pub fn get_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("background_config.json"))
}

pub fn load_config(app: &tauri::AppHandle) -> BackgroundConfig {
    let mut config = if let Ok(path) = get_config_path(app) {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<BackgroundConfig>(&content) {
                    config
                } else {
                    BackgroundConfig::default()
                }
            } else {
                BackgroundConfig::default()
            }
        } else {
            BackgroundConfig::default()
        }
    } else {
        BackgroundConfig::default()
    };

    config.language =
        crate::modules::ai::transcription::normalize_stt_language(&config.language);
    if config.language.is_empty() {
        config.language = "auto".to_string();
    }

    // إصلاح ملف إعدادات تالف بسبب ترميز JSON مزدوج للغة
    if let Ok(path) = get_config_path(app) {
        if config.language.len() <= 8 {
            if let Ok(json_str) = serde_json::to_string_pretty(&config) {
                let _ = std::fs::write(path, json_str);
            }
        }
    }

    config
}

#[tauri::command]
pub fn save_background_config(
    app: tauri::AppHandle,
    provider: String,
    model: String,
    language: String,
    active: bool,
    stt_shortcut: ShortcutDef,
    text_shortcut: ShortcutDef,
    stt_behavior: String,
    text_behavior: String,
) -> Result<(), String> {
    let config = BackgroundConfig {
        provider,
        model,
        language,
        active,
        stt_shortcut,
        text_shortcut,
        stt_behavior,
        text_behavior,
    };
    let path = get_config_path(&app)?;
    let json_str = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_background_config(app: tauri::AppHandle) -> Result<BackgroundConfig, String> {
    Ok(load_config(&app))
}
