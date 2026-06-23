use serde_json::json;

use crate::modules::ai::prompts::text_action_instruction;

pub async fn process_text(
    api_key: &str,
    model: &str,
    action: &str,
    text: &str,
    custom_prompt: Option<String>,
) -> Result<(String, u32, u32), String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model,
        api_key.trim()
    );

    let instruction = text_action_instruction(action, custom_prompt.as_deref());
    let full_prompt = format!("{}\n\n{}", instruction, text);

    let body = json!({
        "contents": [{
            "parts": [{
                "text": full_prompt
            }]
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
        return Err(format!("فشل المعالجة من Gemini ({}): {}", status, err_body));
    }

    let json_res: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("فشل قراءة استجابة Gemini JSON: {}", e))?;

    if let Some(res_text) = json_res["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        let prompt_tokens = json_res["usageMetadata"]["promptTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        let completion_tokens = json_res["usageMetadata"]["candidatesTokenCount"]
            .as_u64()
            .unwrap_or(0) as u32;
        return Ok((
            res_text.trim().to_string(),
            prompt_tokens,
            completion_tokens,
        ));
    }

    Err("فشلت صياغة النص من قبل Gemini".to_string())
}
