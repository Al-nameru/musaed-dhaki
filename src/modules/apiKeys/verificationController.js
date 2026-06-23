export function createApiKeyVerificationController(deps) {
  const getRefs = () => deps.getRefs();

  const toggleModelsCardVisibility = (hasKey) => {
    const { modelsSelectorsContainer, modelsNoKeyWarning } = getRefs();
    if (hasKey) {
      if (modelsSelectorsContainer) modelsSelectorsContainer.style.display = "block";
      if (modelsNoKeyWarning) modelsNoKeyWarning.style.display = "none";
    } else {
      if (modelsSelectorsContainer) modelsSelectorsContainer.style.display = "none";
      if (modelsNoKeyWarning) modelsNoKeyWarning.style.display = "block";
    }
  };

  const setFreeSttEngine = (engine) => {
    const { selectFreeSttEngine, freeSttStatusMsg } = getRefs();
    deps.setFreeSttEngineState(engine);
    localStorage.setItem("bm_free_stt_engine", engine);
    if (selectFreeSttEngine) selectFreeSttEngine.value = engine;
    if (freeSttStatusMsg) freeSttStatusMsg.style.display = engine !== "none" ? "block" : "none";
  };

  const activateGoogleSpeechProvider = () => {
    const { apiKeyInput, keyBadge, keyInfoRow, detectedProvider, detectedValidity } = getRefs();
    deps.bumpApiKeyVerificationRequest();
    deps.setActiveApiKey("");
    deps.setActiveProvider("Google");
    deps.setSpeechModel("google-webspeech");
    localStorage.removeItem("bm_speech_api_key");
    localStorage.setItem("bm_speech_provider", "Google");
    localStorage.setItem("bm_speech_model", "google-webspeech");
    setFreeSttEngine("google-webspeech");
    deps.populateModels("Google", ["google-webspeech"]);
    toggleModelsCardVisibility(true);

    if (apiKeyInput) {
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "Google Web Speech لا يحتاج مفتاح API";
    }
    if (keyBadge) {
      keyBadge.textContent = "🟢 مجاني";
      keyBadge.className = "status-badge valid";
    }
    if (keyInfoRow) keyInfoRow.style.display = "flex";
    if (detectedProvider) detectedProvider.textContent = "Google";
    if (detectedValidity) {
      detectedValidity.textContent = "محرك مدمج للتعرف على الصوت";
      detectedValidity.className = "valid-status";
    }

    deps.addAppAlert("info", "تم تفعيل Google Web Speech", "سيُستخدم Google لتحويل الصوت إلى نص بدون مفتاح API.", {
      source: "المزوّد"
    });
    deps.updateHomeIndicators();
  };

  const saveKeyForProvider = (provider, key) => {
    deps.saveProviderKey(provider, key);
  };

  const applyVerifiedApiKey = (key, res, options = {}) => {
    const { apiKeyInput, keyBadge, keyInfoRow, detectedProvider, detectedValidity, selectProviderCompany } = getRefs();
    deps.setActiveApiKey(key);
    deps.setActiveProvider(res.provider);
    if (res.provider !== "Google" && deps.getFreeSttEngine() === "google-webspeech") {
      setFreeSttEngine("none");
    }

    localStorage.setItem("bm_speech_provider", res.provider);
    saveKeyForProvider(res.provider, key);

    deps.cacheProviderModels(res.provider, res.models || []);

    if (apiKeyInput) {
      apiKeyInput.value = key;
      apiKeyInput.placeholder = "أدخل مفتاح gsk_... أو AIzaSy...";
    }
    if (keyBadge) {
      keyBadge.textContent = "🟢 صالح";
      keyBadge.className = "status-badge valid";
    }
    if (keyInfoRow) keyInfoRow.style.display = "flex";
    if (detectedProvider) detectedProvider.textContent = res.provider;
    if (detectedValidity) {
      detectedValidity.textContent = "نشط وصالح";
      detectedValidity.className = "valid-status";
    }
    if (selectProviderCompany) selectProviderCompany.value = res.provider;

    if (deps.getDiacritizeProvider() === res.provider) {
      deps.populateDiacritizeModels(res.provider);
    }
    deps.populateModels(res.provider, res.models || []);
    toggleModelsCardVisibility(true);
    deps.updateHomeIndicators();
    deps.refreshModelComparisonOptions();

    if (!options.silent) {
      deps.addAppAlert("success", "تم تفعيل مفتاح API", `المزوّد النشط: ${res.provider}`, {
        source: "مفاتيح الذكاء الاصطناعي"
      });
    }
  };

  const resetKeyUI = () => {
    const { keyBadge, keyInfoRow, selectProviderCompany } = getRefs();
    deps.bumpApiKeyVerificationRequest();
    keyBadge.textContent = "لم يتم الفحص";
    keyBadge.className = "status-badge";
    keyInfoRow.style.display = "none";
    toggleModelsCardVisibility(false);
    if (selectProviderCompany) selectProviderCompany.value = "";
    deps.setActiveApiKey("");
    deps.setActiveProvider("");
    deps.updateHomeIndicators();
  };

  const invalidateKey = (errorMsg) => {
    const { keyBadge, keyInfoRow, detectedProvider, detectedValidity, selectProviderCompany } = getRefs();
    deps.bumpApiKeyVerificationRequest();
    keyBadge.textContent = "🔴 غير صالح";
    keyBadge.className = "status-badge invalid";
    keyInfoRow.style.display = "flex";
    detectedProvider.textContent = "-";
    detectedValidity.textContent = errorMsg || "مفتاح مرفوض أو منتهي الصلاحية";
    detectedValidity.className = "";
    toggleModelsCardVisibility(false);
    if (selectProviderCompany) selectProviderCompany.value = "";
    deps.setActiveApiKey("");
    deps.setActiveProvider("");
    deps.updateHomeIndicators();
  };

  const verifyKey = async (key) => {
    const { keyBadge } = getRefs();
    if (!key || key.trim() === "") {
      resetKeyUI();
      return;
    }
    const requestId = deps.bumpApiKeyVerificationRequest();
    keyBadge.textContent = "⏳ جاري التحقق...";
    keyBadge.className = "status-badge";

    try {
      const res = await deps.invoke("verify_api_key", { key });
      if (requestId !== deps.getApiKeyVerificationRequestId()) return;
      if (res.valid) {
        applyVerifiedApiKey(key, res);
      } else {
        invalidateKey();
      }
    } catch (err) {
      if (requestId !== deps.getApiKeyVerificationRequestId()) return;
      invalidateKey(err);
    }
  };

  return {
    toggleModelsCardVisibility,
    setFreeSttEngine,
    activateGoogleSpeechProvider,
    saveKeyForProvider,
    applyVerifiedApiKey,
    verifyKey,
    resetKeyUI,
    invalidateKey
  };
}
