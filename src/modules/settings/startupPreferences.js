import { getProviderKey } from "../ai/api.js";
import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

export function loadStartupPreferences(refs, deps) {
  const { selectProviderCompany, apiKeyInput, selectSpeechLanguage } = refs;

  const savedProvider = stateStore.getItem(StorageKeys.SPEECH_PROVIDER);
  const savedKey = savedProvider ? getProviderKey(savedProvider) : "";
  if (savedProvider === "Google") {
    if (selectProviderCompany) selectProviderCompany.value = "Google";
    deps.activateGoogleSpeechProvider();
  } else if (savedKey) {
    apiKeyInput.value = savedKey;
    deps.verifyKey(savedKey);
  }

  deps.loadSavedBatchKeys();
  deps.loadFailedKeys();
  deps.setupModelComparison();

  const savedLanguage = stateStore.getJSON(StorageKeys.SPEECH_LANGUAGE, "ar");
  if (selectSpeechLanguage) {
    selectSpeechLanguage.value = savedLanguage;
    deps.setSpeechLanguage(savedLanguage);
  }

  return { savedProvider };
}
