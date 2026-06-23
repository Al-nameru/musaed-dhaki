export function attachInitialDomListeners(refs, deps) {
  deps.setupProviderModelControls({
    apiKeyInput: refs.apiKeyInput,
    keyBadge: refs.keyBadge,
    selectProviderCompany: refs.selectProviderCompany,
    selectSpeechModel: refs.selectSpeechModel,
    selectSpeechLanguage: refs.selectSpeechLanguage,
    selectTextModel: refs.selectTextModel,
    selectDiacritizeProvider: refs.selectDiacritizeProvider,
    selectDiacritizeModel: refs.selectDiacritizeModel,
    selectTtsProvider: refs.selectTtsProvider,
    homeSelectProviderCompany: refs.homeSelectProviderCompany,
    homeSelectSpeechModel: refs.homeSelectSpeechModel,
    homeSelectTextModel: refs.homeSelectTextModel,
    homeSelectDiacritizeProvider: refs.homeSelectDiacritizeProvider,
    homeSelectDiacritizeModel: refs.homeSelectDiacritizeModel,
    homeSelectTtsProvider: refs.homeSelectTtsProvider
  }, {
    verifyKey: deps.verifyKey,
    resetKeyUI: deps.resetKeyUI,
    activateGoogleSpeechProvider: deps.activateGoogleSpeechProvider,
    loadProviderKeys: deps.loadProviderKeys,
    getFreeSttEngine: deps.getFreeSttEngine,
    setFreeSttEngine: deps.setFreeSttEngine,
    bumpApiKeyVerificationRequest: deps.bumpApiKeyVerificationRequest,
    setActiveApiKey: deps.setActiveApiKey,
    setActiveProvider: deps.setActiveProvider,
    setSpeechModel: deps.setSpeechModel,
    setSpeechLanguage: deps.setSpeechLanguage,
    setTextModel: deps.setTextModel,
    setDiacritizeProvider: deps.setDiacritizeProvider,
    setDiacritizeModel: deps.setDiacritizeModel,
    toggleModelsCardVisibility: deps.toggleModelsCardVisibility,
    populateDiacritizeModels: deps.populateDiacritizeModels,
    updateHomeIndicators: deps.updateHomeIndicators
  });

  deps.setupHomeSpeechActions({
    btnCopy: refs.btnCopy,
    btnClearText: refs.btnClearText,
    btnSpeak: refs.btnSpeak,
    btnPauseSpeak: refs.btnPauseSpeak,
    btnStopSpeak: refs.btnStopSpeak,
    btnDownloadSpeak: refs.btnDownloadSpeak,
    resultText: refs.resultText,
    recordStatus: refs.recordStatus
  }, {
    getResultText: deps.getResultText,
    setResultText: deps.setResultText,
    speakHomeText: deps.speakHomeText,
    getSelectedTtsProvider: deps.getSelectedTtsProvider,
    getActiveAudio: deps.getActiveAudio,
    getActiveAudioSrc: deps.getActiveAudioSrc,
    bumpTtsPlaybackRequest: deps.bumpTtsPlaybackRequest,
    updateTTSButtonsState: deps.updateTTSButtonsState
  });
}
