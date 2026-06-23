import { setupSecurityControls } from "./securityControls.js";
import { invoke, isTauri } from "../../shared/tauriClient.js";
import { appState } from "../../shared/appState.js";
import { getSttShortcut, getTextShortcut } from "../shortcuts/editor.js";

function resolveSpeechModelForProvider(provider, speechModel) {
  const model = speechModel || "";
  if (provider === "Groq") {
    return model.includes("whisper") ? model : "whisper-large-v3";
  }
  if (provider === "OpenAI") {
    return model.includes("whisper") ? model : "whisper-1";
  }
  if (provider === "Gemini") {
    return model.includes("whisper") ? "gemini-2.0-flash" : (model || "gemini-2.0-flash");
  }
  return model;
}

function sanitizeSpeechLanguage(raw) {
  if (!raw || typeof raw !== "string") return "ar";
  let current = raw.trim();
  for (let i = 0; i < 12; i++) {
    if (current.startsWith('"') && current.endsWith('"')) {
      try {
        const parsed = JSON.parse(current);
        if (typeof parsed === "string" && parsed !== current) {
          current = parsed.trim();
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }
  const base = current.split(/[-_]/)[0].toLowerCase();
  if (/^[a-z]{2,3}$/.test(base)) return base;
  return "ar";
}

export function setupStartupWiring(refs, deps) {
  const { savedProvider } = deps.loadStartupPreferences({
    selectProviderCompany: refs.selectProviderCompany,
    apiKeyInput: refs.apiKeyInput,
    selectSpeechLanguage: refs.selectSpeechLanguage
  }, {
    activateGoogleSpeechProvider: deps.activateGoogleSpeechProvider,
    verifyKey: deps.verifyKey,
    loadSavedBatchKeys: deps.loadSavedBatchKeys,
    loadFailedKeys: deps.loadFailedKeys,
    setupModelComparison: deps.setupModelComparison,
    setSpeechLanguage: deps.setSpeechLanguage
  });

  deps.setupTtsControls({
    selectTtsProvider: refs.selectTtsProvider,
    sliderTtsRate: refs.sliderTtsRate,
    sliderTtsPitch: refs.sliderTtsPitch,
    sliderTtsVolume: refs.sliderTtsVolume,
    selectHomeTtsRate: refs.selectHomeTtsRate,
    selectHomeTtsPitch: refs.selectHomeTtsPitch,
    selectHomeTtsVoice: refs.selectHomeTtsVoice,
    selectTtsVoice: refs.selectTtsVoice,
    displayTtsRate: refs.displayTtsRate,
    displayTtsPitch: refs.displayTtsPitch,
    displayTtsVolume: refs.displayTtsVolume
  }, {
    updateHomeIndicators: deps.updateHomeIndicators,
    updateButtonsState: deps.updateTTSButtonsState,
    populateVoicesList: deps.populateVoicesList,
    getActiveAudio: deps.getActiveAudio,
    getVoices: deps.getVoices,
    setRate: deps.setTtsRate,
    setPitch: deps.setTtsPitch,
    setVolume: deps.setTtsVolume,
    setVoiceName: deps.setTtsVoiceName
  });

  deps.loadAndRegisterShortcuts({
    sttBehavior: deps.getSttShortcutBehavior(),
    textBehavior: deps.getTextShortcutBehavior()
  });
  deps.setupShortcutEditor({
    getBehaviorFor: deps.currentShortcutBehavior,
    onStartRecording: deps.clearSpaceHoldTimer
  });

  deps.setupAutoProcessingControls({
    chkHomeAutoDiacritize: refs.chkHomeAutoDiacritize,
    chkSettingsAutoDiacritize: refs.chkSettingsAutoDiacritize,
    chkHomeAutoGrammar: refs.chkHomeAutoGrammar,
    chkSettingsAutoGrammar: refs.chkSettingsAutoGrammar,
    chkHomeVoiceTranslation: refs.chkHomeVoiceTranslation,
    chkSettingsVoiceTranslation: refs.chkSettingsVoiceTranslation
  }, {
    setAutoDiacritize: deps.setAutoDiacritize,
    setAutoGrammar: deps.setAutoGrammar,
    onAutoDiacritizeEnabled: deps.diacritizeCurrentResultText,
    setVoiceTranslation: deps.setVoiceTranslation
  });

  deps.setupTextOutputControls({
    chkAppendMode: document.getElementById("chk-append-mode"),
    chkSelectionFloatingMenu: refs.chkSelectionFloatingMenu,
    selectOutputTarget: refs.selectOutputTarget,
    chkLiveTranscription: refs.chkLiveTranscription,
    selectTextInsertionMode: refs.selectTextInsertionMode
  }, {
    getSelectionFloatingMenuEnabled: deps.getSelectionFloatingMenuEnabled,
    setSelectionFloatingMenuEnabled: deps.setSelectionFloatingMenuEnabled,
    getTextOutputTarget: deps.getTextOutputTarget,
    setTextOutputTarget: deps.setTextOutputTarget,
    getLiveTranscriptionEnabled: deps.getLiveTranscriptionEnabled,
    setLiveTranscriptionEnabled: deps.setLiveTranscriptionEnabled,
    setAppendMode: deps.setAppendMode,
    getAppendSeparator: deps.getAppendSeparator,
    setAppendSeparator: deps.setAppendSeparator,
    setSelectionMonitorEnabled: deps.setSelectionMonitorEnabled,
    forceHideQuickTools: deps.forceHideQuickTools
  });

  deps.setupFreeSttControls({
    selectFreeSttEngine: refs.selectFreeSttEngine,
    freeSttStatusMsg: refs.freeSttStatusMsg,
    selectProviderCompany: refs.selectProviderCompany
  }, {
    savedProvider,
    getFreeSttEngine: deps.getFreeSttEngine,
    setFreeSttEngine: deps.setFreeSttEngine,
    getActiveApiKey: deps.getActiveApiKey,
    getActiveProvider: deps.getActiveProvider,
    setActiveProvider: deps.setActiveProvider,
    populateModels: deps.populateModels,
    toggleModelsCardVisibility: deps.toggleModelsCardVisibility,
    updateHomeIndicators: deps.updateHomeIndicators
  });

  deps.setupShortcutBehaviorControls({
    selectSttShortcutBehavior: refs.selectSttShortcutBehavior,
    selectTextShortcutBehavior: refs.selectTextShortcutBehavior
  }, {
    getSttShortcutBehavior: deps.getSttShortcutBehavior,
    setSttShortcutBehavior: deps.setSttShortcutBehavior,
    getTextShortcutBehavior: deps.getTextShortcutBehavior,
    setTextShortcutBehavior: deps.setTextShortcutBehavior
  });

  if (refs.selectDiacritizeProvider) refs.selectDiacritizeProvider.value = deps.getDiacritizeProvider();
  deps.populateDiacritizeModels(deps.getDiacritizeProvider());

  // Background config sync helper
  const syncBackgroundConfig = async () => {
    if (!isTauri) return;
    try {
      const freeEngine = appState.get("freeSttEngine") || "none";
      const hasApiKey = !!appState.get("activeApiKey");
      const activeProvider = appState.get("activeProvider") || "Gemini";
      const provider = (freeEngine !== "none" && !hasApiKey) ? "WebSpeech" : activeProvider;
      const rawSpeechModel = appState.get("speechModel");
      const model = resolveSpeechModelForProvider(provider, rawSpeechModel);
      const language = sanitizeSpeechLanguage(appState.get("speechLanguage"));
      const active = appState.get("backgroundRecordingEnabled");
      const sttShortcut = getSttShortcut();
      const textShortcut = getTextShortcut();
      const sttBehavior = appState.get("sttShortcutBehavior") || "toggle";
      const textBehavior = appState.get("textShortcutBehavior") || "single";

      await invoke("save_background_config", {
        provider,
        model,
        language,
        active,
        sttShortcut,
        textShortcut,
        sttBehavior,
        textBehavior
      });
    } catch (err) {
      console.error("Failed to sync background config:", err);
    }
  };

  // Wire up the checkbox
  if (refs.chkBackgroundRecording) {
    refs.chkBackgroundRecording.checked = appState.get("backgroundRecordingEnabled");
    refs.chkBackgroundRecording.addEventListener("change", (e) => {
      appState.set("backgroundRecordingEnabled", e.target.checked);
    });
  }

  // Subscribe to changes to trigger sync
  appState.backgroundRecordingEnabled.subscribe(syncBackgroundConfig);
  appState.activeProvider.subscribe(syncBackgroundConfig);
  appState.speechModel.subscribe(syncBackgroundConfig);
  appState.speechLanguage.subscribe(syncBackgroundConfig);
  appState.sttShortcutBehavior.subscribe(syncBackgroundConfig);
  appState.textShortcutBehavior.subscribe(syncBackgroundConfig);
  appState.freeSttEngine.subscribe(syncBackgroundConfig);
  appState.activeApiKey.subscribe(syncBackgroundConfig);

  syncBackgroundConfig();

  window.addEventListener("shortcut-config-changed", () => {
    syncBackgroundConfig();
  });

  deps.updateHomeIndicators();
  deps.setupPromptSettings();
  setupSecurityControls();
}
