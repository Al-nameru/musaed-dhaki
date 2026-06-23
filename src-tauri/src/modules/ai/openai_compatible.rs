use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde_json::json;

use crate::modules::ai::prompts::text_action_instruction;

pub async fn process_text(
    api_key: &str,
    endpoint: &str,
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
        "temperature": 0.3
    });

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    let response = client
        .post(endpoint)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("خطأ في الاتصال بالخادم: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("فشل الطلب من الخادم ({}): {}", status, err_body));
    }

    let json_res: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("فشل قراءة استجابة JSON: {}", e))?;

    if let Some(res_text) = json_res["choices"][0]["message"]["content"].as_str() {
        let prompt_tokens = json_res["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
        let completion_tokens = json_res["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
        return Ok((
            res_text.trim().to_string(),
            prompt_tokens,
            completion_tokens,
        ));
    }

    Err("فشلت صياغة النص من قبل الخادم".to_string())
}
