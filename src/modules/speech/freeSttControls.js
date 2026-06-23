import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

export function setupFreeSttControls(refs, deps) {
  const { selectFreeSttEngine, freeSttStatusMsg, selectProviderCompany } = refs;

  const savedFreeStt = deps.savedProvider === "Google"
    ? "google-webspeech"
    : (stateStore.getItem(StorageKeys.FREE_STT_ENGINE) || deps.getFreeSttEngine() || "none");

  deps.setFreeSttEngine(savedFreeStt);
  if (savedFreeStt !== "none" && !deps.getActiveApiKey() && deps.getActiveProvider() !== "Google") {
    deps.setActiveProvider("WebSpeech");
  }
  if (selectFreeSttEngine) selectFreeSttEngine.value = savedFreeStt;
  if (freeSttStatusMsg) freeSttStatusMsg.style.display = savedFreeStt !== "none" ? "block" : "none";

  selectFreeSttEngine?.addEventListener("change", (event) => {
    const engine = event.target.value;
    deps.setFreeSttEngine(engine);

    if (engine === "google-webspeech" && !deps.getActiveApiKey()) {
      deps.setActiveProvider("Google");
      stateStore.setItem(StorageKeys.SPEECH_PROVIDER, "Google");
      if (selectProviderCompany) selectProviderCompany.value = "Google";
      deps.populateModels("Google", ["google-webspeech"]);
      deps.toggleModelsCardVisibility(true);
    } else if (engine !== "none" && !deps.getActiveApiKey()) {
      deps.setActiveProvider("WebSpeech");
    } else if (engine === "none" && deps.getActiveProvider() === "Google") {
      deps.setActiveProvider("");
      stateStore.removeItem(StorageKeys.SPEECH_PROVIDER);
      if (selectProviderCompany) selectProviderCompany.value = "";
      deps.toggleModelsCardVisibility(false);
    }

    stateStore.setItem(StorageKeys.FREE_STT_ENGINE, engine);
    if (freeSttStatusMsg) freeSttStatusMsg.style.display = engine !== "none" ? "block" : "none";
    deps.updateHomeIndicators();
  });
}
