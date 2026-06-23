pub fn detect_text_provider(api_key: &str, model: &str) -> &'static str {
    if api_key.starts_with("AIzaSy") {
        "Gemini"
    } else if api_key.starts_with("sk-ant-") {
        "Anthropic"
    } else if api_key.starts_with("gsk_") {
        "Groq"
    } else if api_key.starts_with("sk-or-") {
        "OpenRouter"
    } else if api_key.starts_with("xai-") {
        "xAI"
    } else if api_key.starts_with("sk-") {
        provider_for_openai_compatible_model(model)
    } else {
        "Unknown"
    }
}

pub fn chat_completions_endpoint(api_key: &str, model: &str) -> Option<&'static str> {
    if api_key.starts_with("gsk_") {
        Some("https://api.groq.com/openai/v1/chat/completions")
    } else if api_key.starts_with("sk-or-") {
        Some("https://openrouter.ai/api/v1/chat/completions")
    } else if api_key.starts_with("xai-") {
        Some("https://api.x.ai/v1/chat/completions")
    } else if api_key.starts_with("sk-") {
        Some(openai_compatible_chat_endpoint(model))
    } else {
        None
    }
}

fn provider_for_openai_compatible_model(model: &str) -> &'static str {
    let m_lower = model.to_lowercase();
    if m_lower.contains("deepseek") {
        "DeepSeek"
    } else if m_lower.contains("mistral")
        || m_lower.contains("mixtral")
        || m_lower.contains("codestral")
    {
        "Mistral"
    } else {
        "OpenAI"
    }
}

fn openai_compatible_chat_endpoint(model: &str) -> &'static str {
    let m_lower = model.to_lowercase();
    if m_lower.contains("deepseek") {
        "https://api.deepseek.com/v1/chat/completions"
    } else if m_lower.contains("mistral")
        || m_lower.contains("mixtral")
        || m_lower.contains("codestral")
    {
        "https://api.mistral.ai/v1/chat/completions"
    } else {
        "https://api.openai.com/v1/chat/completions"
    }
}

#[cfg(test)]
mod tests {
    use super::{chat_completions_endpoint, detect_text_provider};

    #[test]
    fn detects_direct_provider_prefixes() {
        assert_eq!(
            detect_text_provider("AIzaSy123", "gemini-1.5-flash"),
            "Gemini"
        );
        assert_eq!(detect_text_provider("sk-ant-123", "claude"), "Anthropic");
        assert_eq!(detect_text_provider("gsk_123", "llama"), "Groq");
        assert_eq!(
            detect_text_provider("sk-or-123", "openai/gpt"),
            "OpenRouter"
        );
        assert_eq!(detect_text_provider("xai-123", "grok"), "xAI");
    }

    #[test]
    fn detects_openai_compatible_models() {
        assert_eq!(detect_text_provider("sk-123", "deepseek-chat"), "DeepSeek");
        assert_eq!(detect_text_provider("sk-123", "mistral-large"), "Mistral");
        assert_eq!(detect_text_provider("sk-123", "mixtral-8x7b"), "Mistral");
        assert_eq!(detect_text_provider("sk-123", "gpt-4o-mini"), "OpenAI");
    }

    #[test]
    fn chooses_chat_completion_endpoints() {
        assert_eq!(
            chat_completions_endpoint("gsk_123", "llama"),
            Some("https://api.groq.com/openai/v1/chat/completions")
        );
        assert_eq!(
            chat_completions_endpoint("sk-or-123", "openai/gpt"),
            Some("https://openrouter.ai/api/v1/chat/completions")
        );
        assert_eq!(
            chat_completions_endpoint("xai-123", "grok"),
            Some("https://api.x.ai/v1/chat/completions")
        );
        assert_eq!(
            chat_completions_endpoint("sk-123", "deepseek-chat"),
            Some("https://api.deepseek.com/v1/chat/completions")
        );
        assert_eq!(
            chat_completions_endpoint("sk-123", "codestral-latest"),
            Some("https://api.mistral.ai/v1/chat/completions")
        );
        assert_eq!(chat_completions_endpoint("unknown", "model"), None);
    }
}
