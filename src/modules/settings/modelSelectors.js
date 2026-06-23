function appendOption(select, value, textContent, disabled = false) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = textContent;
  option.disabled = disabled;
  select.appendChild(option);
}

export function populateProviderModelSelectors(refs, deps, provider, models) {
  const { selectSpeechModel, selectTextModel } = refs;
  selectSpeechModel.innerHTML = "";
  selectTextModel.innerHTML = "";

  if (provider === "Google") {
    appendOption(selectSpeechModel, "google-webspeech", "Google Web Speech API (تحويل صوت إلى نص)");
    appendOption(selectTextModel, "none", "لا يوجد نموذج معالجة نصوص من Google Web Speech", true);
  } else if (provider === "Gemini") {
    models.forEach((model) => {
      appendOption(selectSpeechModel, model, model);
      appendOption(selectTextModel, model, model);
    });
  } else {
    const speechModels = models.filter((model) => model.toLowerCase().includes("whisper"));
    const textModels = models.filter((model) => !model.toLowerCase().includes("whisper"));

    if (speechModels.length > 0) {
      speechModels.forEach((model) => appendOption(selectSpeechModel, model, model));
    } else {
      appendOption(selectSpeechModel, "none", "❌ تحويل الصوت غير مدعوم لهذا المزود", true);
    }

    if (textModels.length > 0) {
      textModels.forEach((model) => appendOption(selectTextModel, model, model));
    } else {
      appendOption(selectTextModel, "default", "النموذج الافتراضي");
    }
  }

  let savedSpeechModel = localStorage.getItem("bm_speech_model");
  let savedTextModel = localStorage.getItem("bm_text_model");

  if (savedSpeechModel) {
    if (savedSpeechModel.startsWith('"') && savedSpeechModel.endsWith('"')) {
      savedSpeechModel = savedSpeechModel.slice(1, -1);
    }
    const hasOption = Array.from(selectSpeechModel.options).some(opt => opt.value === savedSpeechModel);
    if (hasOption) {
      selectSpeechModel.value = savedSpeechModel;
    }
  }

  if (savedTextModel) {
    if (savedTextModel.startsWith('"') && savedTextModel.endsWith('"')) {
      savedTextModel = savedTextModel.slice(1, -1);
    }
    const hasOption = Array.from(selectTextModel.options).some(opt => opt.value === savedTextModel);
    if (hasOption) {
      selectTextModel.value = savedTextModel;
    }
  }

  deps.setSpeechModel(selectSpeechModel.value);
  deps.setTextModel(selectTextModel.value);
  deps.updateHomeIndicators();
}
