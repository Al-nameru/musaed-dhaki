use reqwest::header::{HeaderMap, HeaderValue};
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
    let instruction = text_action_instruction(action, custom_prompt.as_deref());

    let body = json!({
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": format!("{}\n\n{}", instruction, text)
            }
        ],
        "max_tokens": 1024
    });

    let mut headers = HeaderMap::new();
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(api_key.trim()).map_err(|e| format!("Header error: {}", e))?,
    );
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("خطأ في الاتصال بـ Anthropic: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("فشل الطلب من Anthropic ({}): {}", status, err_body));
    }

    let json_res: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("فشل قراءة استجابة JSON من Anthropic: {}", e))?;

    if let Some(res_text) = json_res["content"][0]["text"].as_str() {
        let prompt_tokens = json_res["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
        let completion_tokens = json_res["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
        return Ok((
            res_text.trim().to_string(),
            prompt_tokens,
            completion_tokens,
        ));
    }

    Err("فشلت صياغة النص من قبل Anthropic".to_string())
}
