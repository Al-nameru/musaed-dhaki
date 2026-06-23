import { initAlertsPanel, renderAlertsPanel } from "../modules/alerts/store.js";
import { setupBatchKeyVerification } from "../modules/apiKeys/batchKeys.js";
import { collectAlertsRefs, collectMainDomRefs } from "../modules/settings/domRefs.js";
import { attachInitialDomListenersFromDocument } from "../modules/settings/initialDomBootstrap.js";
import { setupTokenStatsReset } from "../modules/stats/tokenStats.js";

export function setupDomRuntime(deps) {
  const refs = collectMainDomRefs();
  deps.setDomRefs(refs);
  deps.normalizeEditableResultElement();
  initAlertsPanel(collectAlertsRefs());
  setupTokenStatsReset();
  setupBatchKeyVerification({
    getActiveKey: deps.getActiveApiKey,
    activateVerifiedKey: deps.apiKeyVerification.applyVerifiedApiKey,
    saveKeyForProvider: deps.apiKeyVerification.saveKeyForProvider,
    beforeActivateKey: deps.apiKeyVerification.bumpRequest
  });

  try { deps.setupTabs(); } catch (e) { console.warn("setupTabs failed", e); }
  try { deps.setupSettingsSubnav(); } catch (e) { console.warn("setupSettingsSubnav failed", e); }
  try { deps.populateGeneralSettingsOverview(); } catch (e) {}
  try { deps.updateHomeIndicators(); } catch (e) {}
  try { renderAlertsPanel(); } catch (e) {}

  attachInitialDomListenersFromDocument({
    setupProviderModelControls: deps.setupProviderModelControls,
    verifyKey: deps.verifyKey,
    resetKeyUI: deps.apiKeyVerification.resetKeyUI,
    activateGoogleSpeechProvider: deps.apiKeyVerification.activateGoogleSpeechProvider,
    loadProviderKeys: deps.loadProviderKeys,
    getFreeSttEngine: deps.getFreeSttEngine,
    setFreeSttEngine: deps.apiKeyVerification.setFreeSttEngine,
    bumpApiKeyVerificationRequest: deps.apiKeyVerification.bumpRequest,
    setActiveApiKey: deps.setActiveApiKey,
    setActiveProvider: deps.setActiveProvider,
    setSpeechModel: deps.setSpeechModel,
    setSpeechLanguage: deps.setSpeechLanguage,
    setTextModel: deps.setTextModel,
    setDiacritizeProvider: deps.setDiacritizeProvider,
    setDiacritizeModel: deps.setDiacritizeModel,
    toggleModelsCardVisibility: deps.apiKeyVerification.toggleModelsCardVisibility,
    populateDiacritizeModels: deps.populateDiacritizeModels,
    updateHomeIndicators: deps.updateHomeIndicators,
    setupHomeSpeechActions: deps.setupHomeSpeechActions,
    getResultText: deps.getResultText,
    setResultText: deps.setResultText,
    speakHomeText: deps.speakHomeText,
    getSelectedTtsProvider: deps.getSelectedTtsProvider,
    getActiveAudio: deps.ttsController.getActiveAudio,
    getActiveAudioSrc: deps.ttsController.getActiveAudioSrc,
    bumpTtsPlaybackRequest: deps.ttsController.bumpPlaybackRequest,
    updateTTSButtonsState: deps.updateTTSButtonsState
  });
}
