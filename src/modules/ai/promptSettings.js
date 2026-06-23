const DEFAULT_PROMPTS = {
  diacritize: "قم بتشكيل النص العربي التالي بالحركات الإعرابية الصحيحة بالكامل وأرجع النص المشكل فقط:",
  grammar: "صحح الأخطاء النحوية والإملائية في النص التالي وحافظ على المعنى، وأرجع النص المصحح فقط بدون أي مقدمات:",
  translate: "ترجم النص التالي إلى اللغة الأخرى بدقة وأرجع الترجمة فقط بدون أي شروحات:",
  summarize: "لخص النص التالي بشكل مكثف ومفيد وأرجع التلخيص فقط:"
};

const PROMPT_FIELDS = [
  { key: "diacritize", id: "textarea-prompt-diacritize", storageKey: "bm_prompt_diacritize" },
  { key: "grammar", id: "textarea-prompt-grammar", storageKey: "bm_prompt_grammar" },
  { key: "translate", id: "textarea-prompt-translate", storageKey: "bm_prompt_translate" },
  { key: "summarize", id: "textarea-prompt-summarize", storageKey: "bm_prompt_summarize" }
];

export function setupPromptSettings() {
  const fields = PROMPT_FIELDS.map((field) => ({
    ...field,
    element: document.getElementById(field.id)
  }));
  const btnResetPrompts = document.getElementById("btn-reset-prompts");

  fields.forEach((field) => {
    if (!field.element) return;
    field.element.value = localStorage.getItem(field.storageKey) || DEFAULT_PROMPTS[field.key];
    field.element.addEventListener("input", (event) => {
      localStorage.setItem(field.storageKey, event.target.value);
    });
  });

  btnResetPrompts?.addEventListener("click", () => {
    if (!confirm("هل أنت متأكد من رغبتك في استعادة كافة التوجيهات الافتراضية؟")) {
      return;
    }

    fields.forEach((field) => {
      localStorage.removeItem(field.storageKey);
      if (field.element) field.element.value = DEFAULT_PROMPTS[field.key];
    });
  });
}
