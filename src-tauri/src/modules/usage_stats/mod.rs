use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsageLogEntry {
    pub timestamp: u64,
    pub provider: String,
    pub model: String,
    pub action: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    #[serde(default)]
    pub prompt_chars: u32,
    #[serde(default)]
    pub completion_chars: u32,
    #[serde(default)]
    pub prompt_words: u32,
    #[serde(default)]
    pub completion_words: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProviderUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    #[serde(default)]
    pub prompt_chars: u32,
    #[serde(default)]
    pub completion_chars: u32,
    #[serde(default)]
    pub prompt_words: u32,
    #[serde(default)]
    pub completion_words: u32,
    #[serde(default)]
    pub request_count: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ModelUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    #[serde(default)]
    pub prompt_chars: u32,
    #[serde(default)]
    pub completion_chars: u32,
    #[serde(default)]
    pub prompt_words: u32,
    #[serde(default)]
    pub completion_words: u32,
    #[serde(default)]
    pub request_count: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TokenStats {
    pub total_prompt_tokens: u32,
    pub total_completion_tokens: u32,
    #[serde(default)]
    pub total_prompt_chars: u32,
    #[serde(default)]
    pub total_completion_chars: u32,
    #[serde(default)]
    pub total_prompt_words: u32,
    #[serde(default)]
    pub total_completion_words: u32,
    #[serde(default)]
    pub total_requests: u32,
    pub providers: HashMap<String, ProviderUsage>,
    pub models: HashMap<String, ModelUsage>,
    pub history: Vec<UsageLogEntry>,
}

fn stats_file_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("تعذر الحصول على مجلد البيانات: {}", e))?;

    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| format!("فشل إنشاء مجلد البيانات: {}", e))?;
    }

    path.push("token_usage.json");
    Ok(path)
}

pub fn read(app_handle: &tauri::AppHandle) -> TokenStats {
    if let Ok(path) = stats_file_path(app_handle) {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(stats) = serde_json::from_str::<TokenStats>(&content) {
                    return stats;
                }
            }
        }
    }
    TokenStats::default()
}

pub fn write(app_handle: &tauri::AppHandle, stats: &TokenStats) -> Result<(), String> {
    let path = stats_file_path(app_handle)?;
    let content =
        serde_json::to_string_pretty(stats).map_err(|e| format!("فشل تسلسل البيانات: {}", e))?;
    std::fs::write(path, content).map_err(|e| format!("فشل حفظ ملف الإحصائيات: {}", e))?;
    Ok(())
}

pub struct RecordPayload<'a> {
    pub provider: &'a str,
    pub model: &'a str,
    pub action: &'a str,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub prompt_chars: u32,
    pub completion_chars: u32,
    pub prompt_words: u32,
    pub completion_words: u32,
}

pub fn record(app_handle: &tauri::AppHandle, payload: RecordPayload) {
    let mut stats = read(app_handle);

    stats.total_prompt_tokens += payload.prompt_tokens;
    stats.total_completion_tokens += payload.completion_tokens;
    stats.total_prompt_chars += payload.prompt_chars;
    stats.total_completion_chars += payload.completion_chars;
    stats.total_prompt_words += payload.prompt_words;
    stats.total_completion_words += payload.completion_words;
    stats.total_requests += 1;

    let p_entry = stats
        .providers
        .entry(payload.provider.to_string())
        .or_default();
    p_entry.prompt_tokens += payload.prompt_tokens;
    p_entry.completion_tokens += payload.completion_tokens;
    p_entry.prompt_chars += payload.prompt_chars;
    p_entry.completion_chars += payload.completion_chars;
    p_entry.prompt_words += payload.prompt_words;
    p_entry.completion_words += payload.completion_words;
    p_entry.request_count += 1;

    let m_entry = stats.models.entry(payload.model.to_string()).or_default();
    m_entry.prompt_tokens += payload.prompt_tokens;
    m_entry.completion_tokens += payload.completion_tokens;
    m_entry.prompt_chars += payload.prompt_chars;
    m_entry.completion_chars += payload.completion_chars;
    m_entry.prompt_words += payload.prompt_words;
    m_entry.completion_words += payload.completion_words;
    m_entry.request_count += 1;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let entry = UsageLogEntry {
        timestamp,
        provider: payload.provider.to_string(),
        model: payload.model.to_string(),
        action: payload.action.to_string(),
        prompt_tokens: payload.prompt_tokens,
        completion_tokens: payload.completion_tokens,
        prompt_chars: payload.prompt_chars,
        completion_chars: payload.completion_chars,
        prompt_words: payload.prompt_words,
        completion_words: payload.completion_words,
    };

    stats.history.push(entry);

    if stats.history.len() > 100 {
        stats.history.remove(0);
    }

    let _ = write(app_handle, &stats);
}

pub fn reset(app_handle: &tauri::AppHandle) -> Result<(), String> {
    write(app_handle, &TokenStats::default())
}
