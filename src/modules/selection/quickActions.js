const QUICK_TEXT_ACTIONS = {
  grammar: {
    title: "تدقيق إملائي ولغوي",
    subtitle: "تصحيح النص المحدد مع الحفاظ على معناه.",
    loading: "جاري تدقيق النص..."
  },
  diacritize: {
    title: "تشكيل الحركات العربية",
    subtitle: "إضافة الحركات للنص العربي المحدد.",
    loading: "جاري تشكيل النص..."
  },
  translate: {
    title: "ترجمة فورية",
    subtitle: "ترجمة النص المحدد حسب توجيه الترجمة المحفوظ.",
    loading: "جاري ترجمة النص..."
  },
  summarize: {
    title: "تلخيص النص",
    subtitle: "استخراج ملخص واضح من النص المحدد.",
    loading: "جاري تلخيص النص..."
  },
  speak: {
    title: "نطق النص",
    subtitle: "الاستماع إلى النص المحدد أو النتيجة.",
    loading: "جاري تجهيز النطق..."
  }
};

export function setupQuickActions(refs, deps) {
  let useLastSelectionTarget = false;

  function setStatus(message, isError = false) {
    if (!refs.quickActionStatus) return;
    refs.quickActionStatus.textContent = message;
    refs.quickActionStatus.style.color = isError ? "var(--danger)" : "var(--text-muted)";
  }

  function setBusy(isBusy) {
    [refs.btnSpeakQuickAction, refs.btnCopyQuickAction, refs.btnInsertQuickAction].forEach(button => {
      if (button) button.disabled = isBusy;
    });
  }

  async function processAction(action, text) {
    const config = QUICK_TEXT_ACTIONS[action] || QUICK_TEXT_ACTIONS.grammar;
    setBusy(true);
    setStatus(config.loading);

    try {
      const cfg = action === "diacritize"
        ? deps.getDiacritizeConfig()
        : { apiKey: deps.getActiveApiKey(), model: deps.getTextModel() };
      const result = await deps.invoke("ai_process_text", {
        apiKey: cfg.apiKey,
        model: cfg.model,
        action,
        text,
        customPrompt: localStorage.getItem(`bm_prompt_${action}`) || null
      });

      refs.quickActionOutput.value = result;
      setStatus("تمت المعالجة. يمكنك نسخ النتيجة أو إدراجها.");
      refs.quickActionOutput.focus();
      refs.quickActionOutput.select();
    } catch (err) {
      const message = deps.getErrorMessage(err);
      refs.quickActionOutput.value = "";
      setStatus("تعذر تنفيذ الإجراء: " + message, true);
      deps.addAppAlert("error", "فشل إجراء سريع", message, {
        source: QUICK_TEXT_ACTIONS[action]?.title || "شريط الإجراءات السريعة"
      });
    } finally {
      setBusy(false);
    }
  }

  function speakText(text = refs.quickActionOutput?.value || refs.quickActionSource?.value || "") {
    const cleanText = text.trim();
    if (!cleanText || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setStatus("النطق غير متاح في هذه البيئة.", true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = deps.getSpeechLanguage() === "ar" ? "ar-EG" : deps.getSpeechLanguage();
    utterance.rate = deps.getTtsRate();
    utterance.pitch = deps.getTtsPitch();
    utterance.volume = deps.getTtsVolume();
    utterance.onstart = () => setStatus("جاري نطق النص...");
    utterance.onend = () => setStatus("انتهى النطق.");
    utterance.onerror = () => setStatus("تعذر نطق النص.", true);
    window.speechSynthesis.speak(utterance);
  }

  function openDialog(action, text, options = {}) {
    const config = QUICK_TEXT_ACTIONS[action] || QUICK_TEXT_ACTIONS.grammar;
    if (!refs.quickActionDialog || !refs.quickActionTitle || !refs.quickActionSource || !refs.quickActionOutput) {
      return;
    }

    useLastSelectionTarget = !!options.useLastSelectionTarget;
    refs.quickActionTitle.textContent = config.title;
    if (refs.quickActionSubtitle) refs.quickActionSubtitle.textContent = config.subtitle;
    refs.quickActionSource.value = text;
    refs.quickActionOutput.value = action === "speak" ? text : "";
    refs.quickActionDialog.hidden = false;
    deps.hideFloatingTextMenu();

    if (action === "speak") {
      setStatus("جاهز للنطق.");
      speakText(text);
      refs.quickActionOutput.focus();
      return;
    }

    processAction(action, text);
  }

  function closeDialog() {
    if (refs.quickActionDialog) refs.quickActionDialog.hidden = true;
  }

  async function copyOutput() {
    const text = refs.quickActionOutput?.value.trim() || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("تم نسخ النتيجة.");
    } catch (err) {
      setStatus("تعذر النسخ: " + deps.getErrorMessage(err), true);
    }
  }

  async function insertOutput() {
    const text = refs.quickActionOutput?.value.trim() || "";
    if (!text) return;
    try {
      await deps.invoke("write_to_system", {
        text,
        simulateTyping: deps.shouldSimulateTyping(),
        useLastSelectionTarget
      });
      setStatus("تم إدراج النتيجة في المكان النشط.");
    } catch (err) {
      setStatus("تعذر الإدراج: " + deps.getErrorMessage(err), true);
    }
  }

  refs.btnCloseQuickAction?.addEventListener("click", closeDialog);
  refs.btnCopyQuickAction?.addEventListener("click", copyOutput);
  refs.btnInsertQuickAction?.addEventListener("click", insertOutput);
  refs.btnSpeakQuickAction?.addEventListener("click", () => speakText());
  refs.quickActionDialog?.addEventListener("click", (event) => {
    if (event.target === refs.quickActionDialog) closeDialog();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && refs.quickActionDialog && !refs.quickActionDialog.hidden) {
      closeDialog();
    }
  });

  return {
    openDialog,
    closeDialog,
    copyOutput,
    insertOutput,
    speakText,
    setStatus
  };
}
