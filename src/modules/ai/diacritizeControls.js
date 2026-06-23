export function resolveDiacritizeConfig(options) {
  if (options.diacritizeProvider && options.diacritizeModel) {
    const dict = options.loadProviderKeys();
    const key = dict[options.diacritizeProvider];
    if (key) {
      return { apiKey: key, model: options.diacritizeModel };
    }
  }
  return { apiKey: options.activeApiKey, model: options.textModel };
}

function appendOption(select, value, textContent, disabled = false) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = textContent;
  option.disabled = disabled;
  select.appendChild(option);
}

export function populateDiacritizeModelSelect(refs, deps, provider) {
  const { selectDiacritizeModel, diacritizeNoKeyWarning } = refs;
  if (!selectDiacritizeModel) return;
  selectDiacritizeModel.innerHTML = "";

  if (!provider) {
    appendOption(selectDiacritizeModel, "", "(يتبع نموذج النصوص العام)", true);
    selectDiacritizeModel.disabled = true;
    if (diacritizeNoKeyWarning) diacritizeNoKeyWarning.style.display = "none";
    return;
  }

  selectDiacritizeModel.disabled = false;

  let models = deps.getCachedOrFallbackTextModels(provider);
  models = models.filter((model) => !model.toLowerCase().includes("whisper"));

  if (models.length === 0) {
    appendOption(selectDiacritizeModel, "", "❌ لا توجد نماذج نصية لهذا المزوّد", true);
  } else {
    models.forEach((model) => appendOption(selectDiacritizeModel, model, model));
    let saved = localStorage.getItem("bm_diacritize_model");
    if (saved) {
      if (saved.startsWith('"') && saved.endsWith('"')) {
        saved = saved.slice(1, -1);
      }
      const hasOption = Array.from(selectDiacritizeModel.options).some(opt => opt.value === saved);
      if (hasOption) {
        selectDiacritizeModel.value = saved;
      }
    }
    deps.setDiacritizeModel(selectDiacritizeModel.value);
    localStorage.setItem("bm_diacritize_model", selectDiacritizeModel.value);
  }

  const dict = deps.loadProviderKeys();
  if (diacritizeNoKeyWarning) {
    diacritizeNoKeyWarning.style.display = dict[provider] ? "none" : "block";
  }
  deps.updateHomeIndicators();
}

export function createCurrentTextDiacritizer(deps) {
  let timer = null;
  let isRunning = false;

  const schedule = (delay = 900) => {
    if (!deps.getAutoDiacritize() || deps.getSuppressResultTextInput()) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      diacritizeCurrentResultText();
    }, delay);
  };

  const diacritizeCurrentResultText = async () => {
    if (!deps.hasResultTextElement()) return;

    const text = deps.getResultText().trim();
    if (!text) return;
    if (isRunning) return;
    if (text === deps.getLastAutoDiacritizeSource()) return;

    const dia = deps.getDiacritizeConfig();
    if (!dia.apiKey || !dia.model) {
      deps.setStatus("⚠️ لا يمكن التشكيل بدون مفتاح API ونموذج نصوص مفعّل.");
      return;
    }

    const previousStatus = deps.getStatus();
    deps.setStatus("⏳ جاري تشكيل النص الموجود...");
    isRunning = true;

    try {
      const sourceText = text;
      const shapedText = await deps.invoke("ai_process_text", {
        apiKey: dia.apiKey,
        model: dia.model,
        action: "diacritize",
        text,
        customPrompt: localStorage.getItem("bm_prompt_diacritize") || null
      });

      if (deps.getResultText().trim() !== sourceText) {
        deps.setStatus("⏳ تم تعديل النص أثناء التشكيل، ستتم إعادة المحاولة...");
        schedule(250);
        return;
      }

      deps.setSuppressResultTextInput(true);
      deps.setResultText(shapedText);
      deps.setSuppressResultTextInput(false);
      deps.setLastAutoDiacritizeSource(shapedText.trim());
      deps.setStatus("🟢 تم تشكيل النص بنجاح.");
    } catch (err) {
      deps.setStatus("❌ فشل تشكيل النص: " + err);
      setTimeout(() => {
        if (deps.getStatus().startsWith("❌ فشل تشكيل النص")) {
          deps.setStatus(previousStatus || "جاهز للبدء");
        }
      }, 3500);
    } finally {
      isRunning = false;
      deps.setSuppressResultTextInput(false);
    }
  };

  return {
    schedule,
    diacritizeCurrentResultText
  };
}
