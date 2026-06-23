import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

function dispatchSelectChange(select) {
  if (!select) return;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function mirrorSelect(source, target) {
  source?.addEventListener("change", (event) => {
    if (!target) return;
    target.value = event.target.value;
    dispatchSelectChange(target);
  });
}

export function setupProviderModelControls(refs, deps) {
  const {
    apiKeyInput,
    keyBadge,
    selectProviderCompany,
    selectSpeechModel,
    selectSpeechLanguage,
    selectTextModel,
    selectDiacritizeProvider,
    selectDiacritizeModel,
    selectTtsProvider,
    homeSelectProviderCompany,
    homeSelectSpeechModel,
    homeSelectTextModel,
    homeSelectDiacritizeProvider,
    homeSelectDiacritizeModel,
    homeSelectTtsProvider
  } = refs;

  apiKeyInput?.addEventListener("input", (event) => {
    const key = event.target.value.trim();
    deps.verifyKey(key);
  });

  selectProviderCompany?.addEventListener("change", async (event) => {
    const provider = event.target.value;
    if (!provider) {
      deps.setActiveApiKey("");
      deps.setActiveProvider("");
      stateStore.removeItem(StorageKeys.SPEECH_API_KEY);
      stateStore.removeItem(StorageKeys.SPEECH_PROVIDER);
      deps.resetKeyUI();
      return;
    }

    if (provider === "Google") {
      deps.activateGoogleSpeechProvider();
      return;
    }

    if (deps.getFreeSttEngine() === "google-webspeech") {
      deps.setFreeSttEngine("none");
    }
    stateStore.removeItem(StorageKeys.SPEECH_PROVIDER);

    const dict = deps.loadProviderKeys();
    const key = dict[provider];

    if (key) {
      apiKeyInput.value = key;
      deps.verifyKey(key);
    } else {
      deps.bumpApiKeyVerificationRequest();
      deps.setActiveApiKey("");
      deps.setActiveProvider(provider);
      deps.toggleModelsCardVisibility(false);
      deps.updateHomeIndicators();

      apiKeyInput.value = "";
      if (keyBadge) {
        keyBadge.textContent = "⚠️ بحاجة لمفتاح";
        keyBadge.className = "status-badge invalid";
      }
      apiKeyInput.placeholder = `أدخل مفتاح API الخاص بـ ${provider}...`;
    }
  });

  selectSpeechModel?.addEventListener("change", (event) => {
    const speechModel = event.target.value;
    deps.setSpeechModel(speechModel);
    deps.updateHomeIndicators();
  });

  selectSpeechLanguage?.addEventListener("change", (event) => {
    const speechLanguage = event.target.value;
    deps.setSpeechLanguage(speechLanguage);
  });

  selectTextModel?.addEventListener("change", (event) => {
    const textModel = event.target.value;
    deps.setTextModel(textModel);
    deps.updateHomeIndicators();
  });

  selectDiacritizeProvider?.addEventListener("change", (event) => {
    const diacritizeProvider = event.target.value;
    deps.setDiacritizeProvider(diacritizeProvider);
    deps.setDiacritizeModel("");
    deps.populateDiacritizeModels(diacritizeProvider);
    deps.updateHomeIndicators();
  });

  selectDiacritizeModel?.addEventListener("change", (event) => {
    const diacritizeModel = event.target.value;
    deps.setDiacritizeModel(diacritizeModel);
    deps.updateHomeIndicators();
  });

  mirrorSelect(homeSelectProviderCompany, selectProviderCompany);
  mirrorSelect(homeSelectSpeechModel, selectSpeechModel);
  mirrorSelect(homeSelectTextModel, selectTextModel);
  mirrorSelect(homeSelectDiacritizeProvider, selectDiacritizeProvider);
  mirrorSelect(homeSelectDiacritizeModel, selectDiacritizeModel);
  mirrorSelect(homeSelectTtsProvider, selectTtsProvider);
}
