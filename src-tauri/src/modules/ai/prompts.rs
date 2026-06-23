pub fn default_text_action_instruction(action: &str) -> &'static str {
    match action {
        "translate" => "ترجم النص التالي إلى اللغة الأخرى بدقة وأرجع الترجمة فقط بدون أي شروحات:",
        "diacritize" => {
            "قم بتشكيل النص العربي التالي بالحركات الإعرابية الصحيحة بالكامل وأرجع النص المشكل فقط:"
        }
        "grammar" => {
            "صحح الأخطاء النحوية والإملائية في النص التالي وحافظ على المعنى، وأرجع النص المصحح فقط بدون أي مقدمات:"
        }
        "summarize" => "لخص النص التالي بشكل مكثف ومفيد وأرجع التلخيص فقط:",
        _ => "أعد صياغة النص التالي وأرجع النتيجة فقط:",
    }
}

pub fn text_action_instruction<'a>(action: &str, custom_prompt: Option<&'a str>) -> &'a str {
    custom_prompt.unwrap_or_else(|| default_text_action_instruction(action))
}

#[cfg(test)]
mod tests {
    use super::{default_text_action_instruction, text_action_instruction};

    #[test]
    fn returns_custom_prompt_when_present() {
        assert_eq!(
            text_action_instruction("translate", Some("custom")),
            "custom"
        );
    }

    #[test]
    fn returns_known_default_prompt() {
        assert!(default_text_action_instruction("grammar").contains("صحح الأخطاء"));
    }
}
