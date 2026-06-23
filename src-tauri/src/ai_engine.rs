use crate::modules::ai::anthropic;
use crate::modules::ai::gemini;
use crate::modules::ai::openai_compatible;
use crate::modules::ai::provider_detection::chat_completions_endpoint;
use crate::modules::ai::transcription;

pub async fn transcribe_audio(
    api_key: &str,
    provider: &str,
    model: &str,
    audio_base64: &str,
    language: &str,
) -> Result<(String, u32, u32), String> {
    transcription::transcribe_audio(api_key, provider, model, audio_base64, language).await
}

pub async fn transcribe_audio_with_format(
    api_key: &str,
    provider: &str,
    model: &str,
    audio_base64: &str,
    language: &str,
    mime_type: &str,
    file_name: &str,
) -> Result<(String, u32, u32), String> {
    transcription::transcribe_audio_with_format(api_key, provider, model, audio_base64, language, mime_type, file_name).await
}

// معالجة النصوص وتعديلها (ترجمة، تشكيل، تدقيق) عبر المزودين النشطين
pub async fn process_text(
    api_key: &str,
    model: &str,
    action: &str,
    text: &str,
    custom_prompt: Option<String>,
) -> Result<(String, u32, u32), String> {
    let trimmed = api_key.trim();

    if trimmed.starts_with("AIzaSy") {
        return gemini::process_text(api_key, model, action, text, custom_prompt).await;
    }

    if trimmed.starts_with("sk-ant-") {
        return anthropic::process_text(api_key, model, action, text, custom_prompt).await;
    }

    let endpoint = chat_completions_endpoint(trimmed, model)
        .ok_or_else(|| "مزود غير معروف للمفتاح المدخل".to_string())?;

    openai_compatible::process_text(api_key, endpoint, model, action, text, custom_prompt).await
}

// نطق النصوص وجلب دفق الصوت (Google Translate TTS)

pub async fn synthesize_speech(text: &str, provider: &str) -> Result<Vec<u8>, String> {
    crate::modules::speech::tts::synthesize_speech(text, provider).await
}
