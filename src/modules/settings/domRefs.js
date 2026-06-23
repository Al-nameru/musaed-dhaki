export function collectMainDomRefs() {
  return {
    selectTtsVoice: document.getElementById("select-tts-voice"),
    chkSimulateTyping: document.getElementById("chk-simulate-typing"),
    chkHomeAutoDiacritize: document.getElementById("chk-home-auto-diacritize"),
    chkHomeAutoGrammar: document.getElementById("chk-home-auto-grammar"),
    chkSettingsAutoDiacritize: document.getElementById("chk-settings-auto-diacritize"),
    chkSettingsAutoGrammar: document.getElementById("chk-settings-auto-grammar"),
    chkHomeVoiceTranslation: document.getElementById("chk-home-voice-translation"),
    chkSettingsVoiceTranslation: document.getElementById("chk-settings-voice-translation"),
    selectFreeSttEngine: document.getElementById("select-free-stt-engine"),
    freeSttStatusMsg: document.getElementById("free-stt-status-msg"),
    chkLiveTranscription: document.getElementById("chk-live-transcription"),
    selectSttShortcutBehavior: document.getElementById("select-stt-shortcut-behavior"),
    chkBackgroundRecording: document.getElementById("chk-background-recording"),
    selectTextShortcutBehavior: document.getElementById("select-text-shortcut-behavior"),
    selectOutputTarget: document.getElementById("select-output-target"),
    chkSelectionFloatingMenu: document.getElementById("chk-selection-floating-menu"),
    selectProviderCompany: document.getElementById("select-provider-company"),
    selectSpeechModel: document.getElementById("select-speech-model"),
    selectSpeechLanguage: document.getElementById("select-speech-language"),
    selectTextModel: document.getElementById("select-text-model"),
    selectDiacritizeProvider: document.getElementById("select-diacritize-provider"),
    selectDiacritizeModel: document.getElementById("select-diacritize-model"),
    homeSelectProviderCompany: document.getElementById("home-select-provider-company"),
    homeSelectSpeechModel: document.getElementById("home-select-speech-model"),
    homeSelectTextModel: document.getElementById("home-select-text-model"),
    homeSelectDiacritizeProvider: document.getElementById("home-select-diacritize-provider"),
    homeSelectDiacritizeModel: document.getElementById("home-select-diacritize-model"),
    homeSelectTtsProvider: document.getElementById("home-select-tts-provider"),
    selectHomeTtsRate: document.getElementById("select-home-tts-rate"),
    selectHomeTtsPitch: document.getElementById("select-home-tts-pitch"),
    selectHomeTtsVoice: document.getElementById("select-home-tts-voice"),
    selectTextInsertionMode: document.getElementById("dropdown-text-insertion-mode"),
    displayTtsRate: document.getElementById("display-tts-rate"),
    displayTtsPitch: document.getElementById("display-tts-pitch"),
    displayTtsVolume: document.getElementById("display-tts-volume"),
    apiKeyInput: document.getElementById("input-api-key"),
    keyBadge: document.getElementById("key-status-badge"),
    keyInfoRow: document.getElementById("key-info-row"),
    detectedProvider: document.getElementById("detected-provider"),
    detectedValidity: document.getElementById("detected-validity"),
    modelsSelectorsContainer: document.getElementById("models-selectors-container"),
    modelsNoKeyWarning: document.getElementById("models-no-key-warning"),
    diacritizeNoKeyWarning: document.getElementById("diacritize-no-key-warning"),
    btnRecord: document.getElementById("btn-record"),
    recordStatus: document.getElementById("record-status"),
    resultText: document.getElementById("result-text"),
    btnCopy: document.getElementById("btn-copy"),
    btnClearText: document.getElementById("btn-clear-text"),
    btnSpeak: document.getElementById("btn-speak"),
    btnPauseSpeak: document.getElementById("btn-pause-speak"),
    btnStopSpeak: document.getElementById("btn-stop-speak"),
    btnDownloadSpeak: document.getElementById("btn-download-speak"),
    selectTtsProvider: document.getElementById("select-tts-provider"),
    sliderTtsRate: document.getElementById("slider-tts-rate"),
    sliderTtsPitch: document.getElementById("slider-tts-pitch"),
    sliderTtsVolume: document.getElementById("slider-tts-volume")
  };
}

export function collectAlertsRefs() {
  return {
    list: document.getElementById("alerts-list"),
    emptyState: document.getElementById("alerts-empty-state"),
    clearButton: document.getElementById("btn-clear-alerts"),
    filterButtons: document.querySelectorAll(".alerts-filter-btn"),
    errorCount: document.getElementById("alerts-error-count"),
    warningCount: document.getElementById("alerts-warning-count"),
    infoCount: document.getElementById("alerts-info-count")
  };
}

export function collectQuickActionRefs() {
  return {
    floatingMenu: document.getElementById("floating-menu"),
    menuStatus: document.getElementById("menu-status"),
    quickActionDialog: document.getElementById("quick-action-dialog"),
    quickActionTitle: document.getElementById("quick-action-title"),
    quickActionSubtitle: document.getElementById("quick-action-subtitle"),
    quickActionSource: document.getElementById("quick-action-source"),
    quickActionOutput: document.getElementById("quick-action-output"),
    quickActionStatus: document.getElementById("quick-action-status"),
    btnCloseQuickAction: document.getElementById("btn-close-quick-action"),
    btnSpeakQuickAction: document.getElementById("btn-speak-quick-action"),
    btnCopyQuickAction: document.getElementById("btn-copy-quick-action"),
    btnInsertQuickAction: document.getElementById("btn-insert-quick-action")
  };
}
