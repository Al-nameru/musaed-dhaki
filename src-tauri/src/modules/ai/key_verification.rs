use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct KeyVerificationResult {
    pub provider: String,
    pub valid: bool,
    pub models: Vec<String>,
}

async fn verify_groq_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", trimmed))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    let res = client
        .get("https://api.groq.com/openai/v1/models")
        .headers(headers)
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct GroqModel {
                    id: String,
                }
                #[derive(Deserialize)]
                struct GroqResponse {
                    data: Vec<GroqModel>,
                }

                if let Ok(body) = response.json::<GroqResponse>().await {
                    let models: Vec<String> = body
                        .data
                        .into_iter()
                        .map(|m| m.id)
                        .filter(|id| {
                            id.contains("whisper")
                                || id.contains("llama")
                                || id.contains("mixtral")
                                || id.contains("gemma")
                        })
                        .collect();
                    return Ok(KeyVerificationResult {
                        provider: "Groq".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
            Ok(KeyVerificationResult {
                provider: "Groq".to_string(),
                valid: false,
                models: vec![],
            })
        }
        Err(_) => Err("تعذر الاتصال بخوادم Groq".to_string()),
    }
}

async fn verify_gemini_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        trimmed
    );
    let res = client.get(&url).send().await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct GeminiModel {
                    name: String,
                }
                #[derive(Deserialize)]
                struct GeminiResponse {
                    models: Vec<GeminiModel>,
                }

                if let Ok(body) = response.json::<GeminiResponse>().await {
                    let models: Vec<String> = body
                        .models
                        .into_iter()
                        .map(|m| m.name.replace("models/", ""))
                        .filter(|name| name.contains("gemini"))
                        .collect();
                    return Ok(KeyVerificationResult {
                        provider: "Gemini".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
            Ok(KeyVerificationResult {
                provider: "Gemini".to_string(),
                valid: false,
                models: vec![],
            })
        }
        Err(_) => Err("تعذر الاتصال بخوادم Google Gemini".to_string()),
    }
}

async fn verify_anthropic_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(trimmed).map_err(|e| format!("Header error: {}", e))?,
    );
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let res = client
        .get("https://api.anthropic.com/v1/models")
        .headers(headers)
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "Anthropic".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
            Ok(KeyVerificationResult {
                provider: "Anthropic".to_string(),
                valid: false,
                models: vec![],
            })
        }
        Err(_) => Err("تعذر الاتصال بخوادم Anthropic".to_string()),
    }
}

async fn verify_openrouter_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", trimmed))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    let res = client
        .get("https://openrouter.ai/api/v1/models")
        .headers(headers)
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "OpenRouter".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
            Ok(KeyVerificationResult {
                provider: "OpenRouter".to_string(),
                valid: false,
                models: vec![],
            })
        }
        Err(_) => Err("تعذر الاتصال بخوادم OpenRouter".to_string()),
    }
}

async fn verify_xai_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", trimmed))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    let res = client
        .get("https://api.x.ai/v1/models")
        .headers(headers)
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "xAI".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
            Ok(KeyVerificationResult {
                provider: "xAI".to_string(),
                valid: false,
                models: vec![],
            })
        }
        Err(_) => Err("تعذر الاتصال بخوادم xAI".to_string()),
    }
}

async fn verify_sk_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", trimmed))
            .map_err(|e| format!("Header error: {}", e))?,
    );

    // أ. فحص OpenAI
    match client
        .get("https://api.openai.com/v1/models")
        .headers(headers.clone())
        .send()
        .await
    {
        Ok(response) => {
            println!("OpenAI check status: {}", response.status());
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "OpenAI".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
        }
        Err(e) => {
            println!("OpenAI connection error: {:?}", e);
        }
    }

    // ب. فحص DeepSeek
    match client
        .get("https://api.deepseek.com/v1/models")
        .headers(headers.clone())
        .send()
        .await
    {
        Ok(response) => {
            println!("DeepSeek check status: {}", response.status());
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "DeepSeek".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
        }
        Err(e) => {
            println!("DeepSeek connection error: {:?}", e);
        }
    }

    // ج. فحص Mistral
    match client
        .get("https://api.mistral.ai/v1/models")
        .headers(headers.clone())
        .send()
        .await
    {
        Ok(response) => {
            println!("Mistral check status: {}", response.status());
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "Mistral".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
        }
        Err(e) => {
            println!("Mistral connection error: {:?}", e);
        }
    }

    Ok(KeyVerificationResult {
        provider: "OpenAI/DeepSeek/Mistral".to_string(),
        valid: false,
        models: vec![],
    })
}

async fn verify_fallback_key(
    client: &reqwest::Client,
    trimmed: &str,
) -> Result<KeyVerificationResult, String> {
    let mut headers = HeaderMap::new();
    if let Ok(h_val) = HeaderValue::from_str(&format!("Bearer {}", trimmed)) {
        headers.insert(AUTHORIZATION, h_val);

        // أ. تجربة Mistral
        if let Ok(response) = client
            .get("https://api.mistral.ai/v1/models")
            .headers(headers.clone())
            .send()
            .await
        {
            println!("Mistral fallback check status: {}", response.status());
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "Mistral".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
        }

        // ب. تجربة OpenAI
        if let Ok(response) = client
            .get("https://api.openai.com/v1/models")
            .headers(headers.clone())
            .send()
            .await
        {
            println!("OpenAI fallback check status: {}", response.status());
            if response.status().is_success() {
                #[derive(Deserialize)]
                struct ModelItem {
                    id: String,
                }
                #[derive(Deserialize)]
                struct ModelsResponse {
                    data: Vec<ModelItem>,
                }
                if let Ok(body) = response.json::<ModelsResponse>().await {
                    let models = body.data.into_iter().map(|m| m.id).collect();
                    return Ok(KeyVerificationResult {
                        provider: "OpenAI".to_string(),
                        valid: true,
                        models,
                    });
                }
            }
        }
    }

    Err("نمط المفتاح غير معروف أو غير صالح. يدعم النظام مفاتيح Groq و Gemini و OpenAI و Anthropic و Mistral و DeepSeek و OpenRouter و xAI".to_string())
}

// الكشف التلقائي والتحقق من صلاحية مفاتيح الـ API
pub async fn verify_api_key(api_key: &str) -> Result<KeyVerificationResult, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("مفتاح الـ API فارغ".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(7))
        .build()
        .map_err(|e| format!("Failed to build reqwest client: {}", e))?;

    if trimmed.starts_with("gsk_") {
        verify_groq_key(&client, trimmed).await
    } else if trimmed.starts_with("AIzaSy") {
        verify_gemini_key(&client, trimmed).await
    } else if trimmed.starts_with("sk-ant-") {
        verify_anthropic_key(&client, trimmed).await
    } else if trimmed.starts_with("sk-or-") {
        verify_openrouter_key(&client, trimmed).await
    } else if trimmed.starts_with("xai-") {
        verify_xai_key(&client, trimmed).await
    } else if trimmed.starts_with("sk-") {
        verify_sk_key(&client, trimmed).await
    } else {
        verify_fallback_key(&client, trimmed).await
    }
}
