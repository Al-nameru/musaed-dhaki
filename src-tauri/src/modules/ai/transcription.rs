use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::Deserialize;
use serde_json::json;

use super::security;

#[derive(Debug, Clone)]
pub struct SttCredentials {
    pub api_key: String,
    pub provider: String,
    pub model: String,
}

pub fn normalize_stt_language(language: &str) -> String {
    let mut current = language.trim().to_string();

    for _ in 0..12 {
        if current.starts_with('"') && current.ends_with('"') {
            if let Ok(unwrapped) = serde_json::from_str::<String>(&current) {
                if unwrapped == current {
                    break;
                }
                current = unwrapped.trim().to_string();
                continue;
            }
        }
        break;
    }

    if current.is_empty() || current.eq_ignore_ascii_case("auto") {
        return String::new();
    }

    if current.len() > 12 {
        current = current
            .chars()
            .filter(|c| c.is_ascii_alphabetic() || *c == '-' || *c == '_')
            .collect();
        current = current.trim().to_string();
    }

    let base = current
        .split(&['-', '_'][..])
        .next()
        .unwrap_or(&current)
        .to_lowercase();

    if (2..=3).contains(&base.len()) && base.chars().all(|c| c.is_ascii_alphabetic()) {
        return base;
    }

    String::new()
}

pub fn stt_model_for_provider(provider: &str, configured_model: &str) -> String {
    let configured = configured_model.trim();
    match provider {
        "Groq" => {
            if configured.contains("whisper") || configured.contains("distil") {
                configured.to_string()
            } else {
                "whisper-large-v3".to_string()
            }
        }
        "OpenAI" => {
            if configured.contains("whisper") {
                configured.to_string()
            } else {
                "whisper-1".to_string()
            }
        }
        "Gemini" => {
            if configured.contains("whisper") || configured.is_empty() {
                "gemini-2.0-flash".to_string()
            } else {
                configured.to_string()
            }
        }
        _ => configured.to_string(),
    }
}

fn try_stt_credentials(provider: &str, model: &str) -> Option<SttCredentials> {
    if provider.is_empty() || provider == "WebSpeech" {
        return None;
    }
    let api_key = security::load_secure_api_key(provider.to_string()).ok()?;
    if api_key.trim().is_empty() {
        return None;
    }
    Some(SttCredentials {
        api_key,
        provider: provider.to_string(),
        model: stt_model_for_provider(provider, model),
    })
}

pub fn build_stt_credentials_chain(
    config_provider: &str,
    config_model: &str,
) -> Result<Vec<SttCredentials>, String> {
    let mut chain: Vec<SttCredentials> = Vec::new();

    let mut push_unique = |creds: SttCredentials| {
        if !chain
            .iter()
            .any(|c| c.provider == creds.provider && c.model == creds.model)
        {
            chain.push(creds);
        }
    };

    if let Some(primary) = try_stt_credentials(config_provider, config_model) {
        push_unique(primary);
        if config_provider == "Gemini" {
            let gemini_fallback = stt_model_for_provider("Gemini", "gemini-2.0-flash");
            if gemini_fallback != config_model {
                if let Some(creds) = try_stt_credentials("Gemini", &gemini_fallback) {
                    push_unique(creds);
                }
            }
        }
    }

    for (provider, model) in [
        ("Groq", "whisper-large-v3"),
        ("OpenAI", "whisper-1"),
        ("Gemini", "gemini-2.0-flash"),
    ] {
        if let Some(creds) = try_stt_credentials(provider, model) {
            push_unique(creds);
        }
    }

    if chain.is_empty() {
        return Err(
            "لم يتم العثور على مفتاح API. أضف مفتاحاً في تبويب المفاتيح.".to_string(),
        );
    }

    Ok(chain)
}

pub async fn transcribe_stt_with_fallbacks(
    config_provider: &str,
    config_model: &str,
    audio_base64: &str,
    language: &str,
    mime_type: &str,
    file_name: &str,
) -> Result<(String, u32, u32, SttCredentials), String> {
    let language = normalize_stt_language(language);
    let credentials_chain = build_stt_credentials_chain(config_provider, config_model)?;

    let mut last_err = "فشل تحويل الصوت".to_string();
    for creds in credentials_chain {
        match transcribe_audio_with_format(
            &creds.api_key,
            &creds.provider,
            &creds.model,
            audio_base64,
            &language,
            mime_type,
            file_name,
        )
        .await
        {
            Ok((text, prompt_tokens, completion_tokens)) if !text.trim().is_empty() => {
                return Ok((text, prompt_tokens, completion_tokens, creds));
            }
            Ok(_) => {
                last_err = "لم يتم التعرف على أي كلام.".to_string();
            }
            Err(err) => {
                log::warn!(
                    "STT failed for {} / {}: {}",
                    creds.provider,
                    creds.model,
                    err
                );
                last_err = err;
            }
        }
    }

    Err(last_err)
}

fn parse_api_error_message(body: &str) -> String {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = json["error"]["message"].as_str() {
            return msg.to_string();
        }
        if let Some(msg) = json["message"].as_str() {
            return msg.to_string();
        }
    }
    if body.len() > 240 {
        format!("{}…", &body[..240])
    } else {
        body.to_string()
    }
}

async fn transcribe_groq_openai(
    client: &reqwest::Client,
    api_key: &str,
    provider: &str,
    model: &str,
    bytes: Vec<u8>,
    language: &str,
    file_name: &str,
    mime_type: &str,
) -> Result<(String, u32, u32), String> {
    let endpoint = if provider == "Groq" {
        "https://api.groq.com/openai/v1/audio/transcriptions"
    } else {
        "https://api.openai.com/v1/audio/transcriptions"
    };

    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(file_name.to_string())
        .mime_str(mime_type)
        .map_err(|e| format!("Multipart Part error: {}", e))?;

    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", model.to_string());

    if !language.is_empty() && language != "auto" {
        form = form.text("language", language.to_string());
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    let response = client
        .post(endpoint)
        .headers(headers)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("خطأ في الاتصال بخدمة تفريغ الصوت: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        let detail = parse_api_error_message(&err_body);
        return Err(format!(
            "فشل الطلب من خدمة تفريغ الصوت ({}): {}",
            status, detail
        ));
    }

    #[derive(Deserialize)]
    struct TranscribeResponse {
        text: String,
    }

    let result = response
        .json::<TranscribeResponse>()
        .await
        .map_err(|e| format!("فشل قراءة استجابة JSON للتحويل: {}", e))?;

    let word_count = result.text.split_whitespace().count() as u32;
    let completion_tokens = (word_count as f32 * 1.3) as u32;

    Ok((result.text, 0, completion_tokens))
}

async fn transcribe_gemini(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    audio_base64: &str,
    mime_type: &str,
) -> Result<(String, u32, u32), String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model,
        api_key.trim()
    );

    let body = json!({
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": audio_base64
                    }
                },
                {
                    "text": "قم بتحويل هذا الصوت إلى نص بدقة عالية جداً وباللغة الأصلية المنطوقة. أرجع النص فقط بدون إضافة أي تعليق أو مقدمات أو علامات إضافية."
                }
            ]
        }]
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("خطأ في الاتصال بـ Gemini: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("فشل الطلب من Gemini ({}): {}", status, err_body));
    }

    let json_res: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("فشل قراءة استجابة Gemini JSON: {}", e))?;

    if let Some(text) = json_res["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        let prompt_tokens = json_res["usageMetadata"]["promptTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        let completion_tokens = json_res["usageMetadata"]["candidatesTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        return Ok((text.trim().to_string(), prompt_tokens, completion_tokens));
    }

    Err("لم يرجع Gemini أي نص في الاستجابة".to_string())
}

pub async fn transcribe_audio(
    api_key: &str,
    provider: &str,
    model: &str,
    audio_base64: &str,
    language: &str,
) -> Result<(String, u32, u32), String> {
    transcribe_audio_with_format(api_key, provider, model, audio_base64, language, "audio/webm", "audio.webm").await
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
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, audio_base64)
        .map_err(|e| format!("فشل فك تشفير الصوت: {}", e))?;

    let client = reqwest::Client::new();

    if provider == "Groq" || provider == "OpenAI" {
        let (text, prompt_tokens, completion_tokens) =
            transcribe_groq_openai(&client, api_key, provider, model, bytes.clone(), language, file_name, mime_type).await?;

        if text.trim().is_empty() && !language.is_empty() {
            // إعادة المحاولة بدون تحديد اللغة إذا كانت فارغة النتيجة
            let (retry_text, p, c) = transcribe_groq_openai(
                &client, api_key, provider, model, bytes, "", file_name, mime_type,
            ).await?;
            return Ok((retry_text, p, c));
        }

        Ok((text, prompt_tokens, completion_tokens))
    } else if provider == "Gemini" {
        transcribe_gemini(&client, api_key, model, audio_base64, mime_type).await
    } else {
        Err("مزود غير معروف".to_string())
    }
}
