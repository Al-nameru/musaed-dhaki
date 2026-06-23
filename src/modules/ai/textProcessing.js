export async function applyAutomaticTextProcessing(text, options) {
  let processedText = text;

  if (options.autoTranslate) {
    options.setStatus("⏳ جاري الترجمة الفورية...");
    try {
      processedText = await options.invoke("ai_process_text", {
        apiKey: options.activeApiKey,
        model: options.textModel,
        action: "translate",
        text: processedText,
        customPrompt: localStorage.getItem("bm_prompt_translate") || null
      });
    } catch (err) {
      console.error("Auto translation failed:", err);
    }
  }

  if (options.autoGrammar) {
    options.setStatus("⏳ جاري التدقيق النحوي والإملائي...");
    try {
      processedText = await options.invoke("ai_process_text", {
        apiKey: options.activeApiKey,
        model: options.textModel,
        action: "grammar",
        text: processedText,
        customPrompt: localStorage.getItem("bm_prompt_grammar") || null
      });
    } catch (err) {
      console.error("Auto grammar correction failed:", err);
    }
  }

  if (options.autoDiacritize) {
    options.setStatus("⏳ جاري تشكيل النص العربي...");
    try {
      const dia = options.getDiacritizeConfig();
      processedText = await options.invoke("ai_process_text", {
        apiKey: dia.apiKey,
        model: dia.model,
        action: "diacritize",
        text: processedText,
        customPrompt: localStorage.getItem("bm_prompt_diacritize") || null
      });
    } catch (err) {
      console.error("Auto diacritization failed:", err);
    }
  }

  return processedText;
}
