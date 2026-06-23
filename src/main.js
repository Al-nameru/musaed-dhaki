import { invoke, isTauri, listen } from "./shared/tauriClient.js";
import { stateStore } from "./shared/stateStore.js";
import { StorageKeys } from "./shared/storageKeys.js";
import { appState } from "./shared/appState.js";
import { createActiveTabRuntime } from "./app/activeTabRuntime.js";
import { setupDomRuntime } from "./app/domRuntime.js";
import { setupFrontendRuntime } from "./app/frontendRuntime.js";
import { createModelComparisonRuntime } from "./app/modelComparisonRuntime.js";
import { setupStartupRuntime } from "./app/startupRuntime.js";
import {
  addAppAlert,
  getErrorMessage,
  loadAlertsLog,
  renderAlertsPanel,
  setupGlobalAlertHandlers
} from "./modules/alerts/store.js";
import { createApiKeyVerificationBootstrap } from "./modules/apiKeys/bootstrap.js";
import {
  restoreSidebarTabOrder,
  setupSidebarTabDragAndDrop
} from "./modules/navigation/sidebarOrder.js";
import { waitForAppDomReady } from "./modules/navigation/appReady.js";
import { createNavigationTabs } from "./modules/navigation/tabs.js";
import {
  cacheProviderModels,
  getCachedOrFallbackTextModels,
  loadProviderKeys,
  saveProviderKey,
  initProviderKeys
} from "./modules/ai/providerModels.js";
import { errorInspector } from "./shared/errorInspector.js";
import { applyAutomaticTextProcessing } from "./modules/ai/textProcessing.js";
import {
  createCurrentTextDiacritizer,
  populateDiacritizeModelSelect,
  resolveDiacritizeConfig
} from "./modules/ai/diacritizeControls.js";
import {
  isBareSpaceAssignedAsShortcut,
  isShortcutRecording,
  normalizeSttShortcutBehavior,
  normalizeTextShortcutBehavior,
  shortcutBehaviorFor as resolveShortcutBehavior,
  getSttShortcut,
} from "./modules/shortcuts/editor.js";
import { setupSpaceHoldShortcut } from "./modules/shortcuts/spaceHold.js";
import { playBeepSound, playStopBeepSound } from "./modules/speech/audioCues.js";
import { setupHomeSpeechActions } from "./modules/speech/homeSpeechActions.js";
import { createTtsAppController } from "./modules/speech/ttsAppController.js";
import { createRecordingController } from "./modules/speech/recordingController.js";
import { attachRecordButtonHandler } from "./modules/speech/recordButton.js";
import { createResultTextController } from "./modules/text/resultTextController.js";
import {
  resolveTextOutputRoute,
  writeTextToExternalTarget
} from "./modules/text/outputRouting.js";
import { createExternalTargetCapture } from "./modules/text/externalTargetCapture.js";
import { setupProviderModelControls } from "./modules/settings/providerModelControls.js";
import { updateHomeIndicatorsView } from "./modules/settings/homeIndicators.js";
import { populateProviderModelSelectors } from "./modules/settings/modelSelectors.js";
import { createGeneralSettingsOverview } from "./modules/settings/generalOverview.js";
import { loadTokenStats } from "./modules/stats/tokenStats.js";
let chkSimulateTyping;
let selectProviderCompany;
let selectSpeechModel;
let selectTextModel;
let selectDiacritizeProvider;
let selectDiacritizeModel;
let homeSelectProviderCompany;
let homeSelectSpeechModel;
let homeSelectTextModel;
let homeSelectDiacritizeProvider;
let homeSelectDiacritizeModel;
let homeSelectTtsProvider;
let apiKeyInput;
let diacritizeNoKeyWarning;
let selectSpeechLanguage;
let lastAutoDiacritizeSource = "";
let suppressResultTextInput = false;

let btnRecord, recordStatus, resultText;
let selectTtsProvider;

if (appState.get("freeSttEngine") !== "none" && !appState.get("activeApiKey")) {
  appState.set("activeProvider", "WebSpeech");
}

function currentShortcutBehavior(eventName) {
  return resolveShortcutBehavior(eventName, {
    sttBehavior: appState.get("sttShortcutBehavior"),
    textBehavior: appState.get("textShortcutBehavior")
  });
}
const externalTargetCapture = createExternalTargetCapture({
  isTauri,
  invoke,
  getTextOutputTarget: () => appState.get("textOutputTarget")
});
const resultTextController = createResultTextController({
  getResultTextElement: () => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl !== document.body && (
      (activeEl.tagName === "INPUT" && /text|search|url|tel|email|password/i.test(activeEl.type || "text")) ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.getAttribute("contenteditable") === "true" ||
      activeEl.isContentEditable
    )) {
      return activeEl;
    }
    const custom = stateStore.getItem(StorageKeys.TARGET_INSERTION_SELECTOR);
    if (custom) { const el = document.querySelector(custom); if (el) return el; }
    return resultText;
  },
  getAppendMode: () => appState.get("appendMode"),
  setAppendMode: (value) => { appState.set("appendMode", value); },
  getAppendSeparator: () => appState.get("appendSeparator"),
  getTextInsertionMode: () => appState.get("textInsertionMode"),
  setSuppressResultTextInput: (value) => { suppressResultTextInput = value; },
  setLastAutoDiacritizeSource: (value) => { lastAutoDiacritizeSource = value; }
});
const recordingController = createRecordingController({
  invoke,
  isTauri,
  captureExternalTarget: externalTargetCapture.capture,
  getResultText,
  isAppendModeEnabled,
  setResultText,
  addAppAlert,
  playBeepSound,
  playStopBeepSound,
  applyAutomaticTextProcessing,
  resolveTextOutputRoute,
  writeTextToExternalTarget,
  getDiacritizeConfig,
  getActiveApiKey: () => appState.get("activeApiKey"),
  getActiveProvider: () => appState.get("activeProvider"),
  getSpeechModel: () => appState.get("speechModel"),
  getSpeechLanguage: () => appState.get("speechLanguage"),
  getAutoGrammar: () => appState.get("autoGrammar"),
  getAutoDiacritize: () => appState.get("autoDiacritize"),
  getTextModel: () => appState.get("textModel"),
  getTextOutputTarget: () => appState.get("textOutputTarget"),
  getExternalTargetCaptured: externalTargetCapture.wasCaptured,
  getLiveTranscriptionEnabled: () => appState.get("liveTranscriptionEnabled"),
  getFreeSttEngine: () => appState.get("freeSttEngine"),
  applyResultText,
  shouldSimulateTyping: () => !!chkSimulateTyping?.checked,
  setSuppressResultTextInput: (value) => { suppressResultTextInput = value; },
  setLastAutoDiacritizeSource: (value) => { lastAutoDiacritizeSource = value; },
  getRecordButton: () => btnRecord,
  getRecordStatus: () => recordStatus,
  getVoiceTranslationEnabled: () => appState.get("voiceTranslation"),
  speakText: (text) => speakHomeText(text),
  getTextInsertionMode: () => appState.get("textInsertionMode")
});

const clearSpaceHoldTimer = setupSpaceHoldShortcut({
  isShortcutRecording,
  getSttShortcut,
  getSttShortcutBehavior: () => appState.get("sttShortcutBehavior"),
  startStt: () => recordingController.startSttShortcut(true),
  stopStt: () => recordingController.stopSttShortcut(true),
  toggleRecording: (isShortcut) => toggleRecording(isShortcut),
  isRecordingActive: () => recordingController.isRecordingActive()
});

const apiKeyVerification = createApiKeyVerificationBootstrap({
  invoke,
  addAppAlert,
  cacheProviderModels,
  saveProviderKey,
  getFreeSttEngine: () => appState.get("freeSttEngine"),
  setFreeSttEngineState: (value) => { appState.set("freeSttEngine", value); },
  setActiveApiKey: (value) => { appState.set("activeApiKey", value); },
  setActiveProvider: (value) => { appState.set("activeProvider", value); },
  setSpeechModel: (value) => { appState.set("speechModel", value); },
  getDiacritizeProvider: () => appState.get("diacritizeProvider"),
  populateModels,
  populateDiacritizeModels,
  updateHomeIndicators,
  refreshModelComparisonOptions: () => modelComparison.refreshOptions()
});

const currentTextDiacritizer = createCurrentTextDiacritizer({
  invoke,
  getAutoDiacritize: () => autoDiacritize,
  getSuppressResultTextInput: () => suppressResultTextInput,
  hasResultTextElement: () => !!resultText,
  getResultText,
  setResultText,
  getLastAutoDiacritizeSource: () => lastAutoDiacritizeSource,
  setLastAutoDiacritizeSource: (value) => { lastAutoDiacritizeSource = value; },
  getDiacritizeConfig,
  getStatus: () => recordStatus.textContent,
  setStatus: (message) => { recordStatus.textContent = message; },
  setSuppressResultTextInput: (value) => { suppressResultTextInput = value; }
});

const generalSettingsOverview = createGeneralSettingsOverview();
const navigationTabs = createNavigationTabs({
  restoreSidebarTabOrder,
  setupSidebarTabDragAndDrop,
  loadTokenStats,
  renderAlertsPanel,
  setupModelComparison: () => modelComparison.setup(),
  refreshModelComparisonOptions: () => modelComparison.refreshOptions(),
  abortModelComparison: () => modelComparison.abort()
});
let ttsOrigHtml = "", ttsIsSpeaking = false;
function highlightWord(charIndex, charLength) {
  const el = resultTextController?.getResultTextElement() || resultText; if (!el) return;
  if (!ttsIsSpeaking) { ttsOrigHtml = el.innerHTML; el.innerHTML = el.textContent.replace(/(\S+)/g, (m, p1, o) => `<span class="tts-word-span" data-start="${o}" data-end="${o+m.length}">${m}</span>`); ttsIsSpeaking = true; }
  el.querySelectorAll(".tts-word-span").forEach(span => {
    const start = parseInt(span.dataset.start), end = parseInt(span.dataset.end);
    if (charIndex >= start && charIndex < end) {
      span.classList.add("tts-word-highlight");
      span.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      span.classList.remove("tts-word-highlight");
    }
  });
}
function cleanWordHighlight() {
  const el = resultTextController?.getResultTextElement() || resultText; if (el && ttsIsSpeaking) el.innerHTML = ttsOrigHtml;
  ttsIsSpeaking = false;
}
const ttsController = createTtsAppController({
  invoke,
  getErrorMessage,
  addAppAlert,
  onWordHighlight: highlightWord,
  onWordHighlightClean: cleanWordHighlight
});
const modelComparison = createModelComparisonRuntime({
  invoke,
  getErrorMessage,
  getActiveProvider: () => appState.get("activeProvider"),
  getActiveApiKey: () => appState.get("activeApiKey")
});
const activeTabRefresh = createActiveTabRuntime({
  normalizeEditableResultElement,
  updateHomeIndicators,
  updateTTSButtonsState,
  getApiKeyInputValue: () => apiKeyInput?.value || "",
  verifyKey,
  modelComparison,
  resetGeneralSettingsOverview: generalSettingsOverview.reset,
  populateGeneralSettingsOverview,
  getSttShortcutBehavior: () => appState.get("sttShortcutBehavior"),
  getTextShortcutBehavior: () => appState.get("textShortcutBehavior"),
  activateNavTab
});

loadAlertsLog();
setupGlobalAlertHandlers();
const appDomReady = waitForAppDomReady();

function onAppDomReady(callback) {
  appDomReady.then(callback).catch((err) => {
    console.error("App DOM initialization failed:", err);
  });
}

function activateNavTab(item) {
  return navigationTabs.activateNavTab(item);
}

function setupTabs() {
  return navigationTabs.setupTabs();
}

function setupSettingsSubnav() {
  return navigationTabs.setupSettingsSubnav();
}

function populateGeneralSettingsOverview() {
  return generalSettingsOverview.populate();
}

onAppDomReady(populateGeneralSettingsOverview);
onAppDomReady(() => {
  setupDomRuntime({
    setDomRefs: (refs) => {
      ({
        chkSimulateTyping,
        selectProviderCompany,
        selectSpeechModel,
        selectSpeechLanguage,
        selectTextModel,
        selectDiacritizeProvider,
        selectDiacritizeModel,
        homeSelectProviderCompany,
        homeSelectSpeechModel,
        homeSelectTextModel,
        homeSelectDiacritizeProvider,
        homeSelectDiacritizeModel,
        homeSelectTtsProvider,
        apiKeyInput,
        diacritizeNoKeyWarning,
        btnRecord,
        recordStatus,
        resultText,
        selectTtsProvider
      } = refs);
    },
    normalizeEditableResultElement,
    getActiveApiKey: () => appState.get("activeApiKey"),
    apiKeyVerification,
    setupTabs,
    setupSettingsSubnav,
    populateGeneralSettingsOverview,
    updateHomeIndicators,
    setupProviderModelControls,
    verifyKey,
    loadProviderKeys,
    getFreeSttEngine: () => appState.get("freeSttEngine"),
    setActiveApiKey: (value) => { appState.set("activeApiKey", value); },
    setActiveProvider: (value) => { appState.set("activeProvider", value); },
    setSpeechModel: (value) => { appState.set("speechModel", value); },
    setSpeechLanguage: (value) => { appState.set("speechLanguage", value); },
    setTextModel: (value) => { appState.set("textModel", value); },
    setDiacritizeProvider: (value) => { appState.set("diacritizeProvider", value); },
    setDiacritizeModel: (value) => { appState.set("diacritizeModel", value); },
    populateDiacritizeModels,
    setupHomeSpeechActions,
    getResultText,
    setResultText,
    speakHomeText,
    getSelectedTtsProvider,
    ttsController,
    updateTTSButtonsState
  });
});

function normalizeEditableResultElement() { return resultTextController.normalizeEditableElement(); }
function getResultText() { return resultTextController.getText(); }
function setResultText(value) { return resultTextController.setText(value); }
function isAppendModeEnabled() { return resultTextController.isAppendModeEnabled(); }
function applyResultText(text) { return resultTextController.applyText(text); }


function updateHomeIndicators() {
  updateHomeIndicatorsView({
    selectProviderCompany,
    selectSpeechModel,
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
  }, {
    activeProvider: appState.get("activeProvider"),
    speechModel: appState.get("speechModel"),
    textModel: appState.get("textModel"),
    diacritizeProvider: appState.get("diacritizeProvider"),
    diacritizeModel: appState.get("diacritizeModel")
  });
}

async function verifyKey(key) {
  return apiKeyVerification.verifyKey(key);
}

function populateModels(provider, models) {
  return populateProviderModelSelectors({
    selectSpeechModel,
    selectTextModel
  }, {
    setSpeechModel: (value) => { appState.set("speechModel", value); },
    setTextModel: (value) => { appState.set("textModel", value); },
    updateHomeIndicators
  }, provider, models);
}

function getDiacritizeConfig() {
  return resolveDiacritizeConfig({
    diacritizeProvider: appState.get("diacritizeProvider"),
    diacritizeModel: appState.get("diacritizeModel"),
    loadProviderKeys,
    activeApiKey: appState.get("activeApiKey"),
    textModel: appState.get("textModel")
  });
}

function populateDiacritizeModels(provider) {
  return populateDiacritizeModelSelect({
    selectDiacritizeModel,
    diacritizeNoKeyWarning
  }, {
    getCachedOrFallbackTextModels,
    loadProviderKeys,
    setDiacritizeModel: (value) => { appState.set("diacritizeModel", value); },
    updateHomeIndicators
  }, provider);
}

const toggleRecording = (isShortcut = false) => recordingController.toggleRecording(isShortcut === true);
window.toggleRecording = toggleRecording;
attachRecordButtonHandler({ getButton: () => btnRecord || document.getElementById("btn-record"), toggleRecording });
const processAudioTranscription = (blob) => recordingController.processAudioTranscription(blob);
window.processAudioTranscription = processAudioTranscription;
function scheduleCurrentTextDiacritization(delay = 900) { return currentTextDiacritizer.schedule(delay); }
function diacritizeCurrentResultText() { return currentTextDiacritizer.diacritizeCurrentResultText(); }
function updateTTSButtonsState(state) { return ttsController.updateButtonsState(state); }
function getSelectedTtsProvider() { return ttsController.getSelectedProvider(); }

async function speakHomeText(text) {
  return ttsController.speakHomeText(text);
}
function populateVoicesList() {
  return ttsController.populateVoicesList();
}
let frontendRuntime = {
  showFloatingTextMenu: () => {},
  hideFloatingTextMenu: () => {},
  forceHideQuickTools: () => {},
  setSelectionMonitorEnabled: () => {}
};

async function refreshActiveTab() {
  return activeTabRefresh.refresh();
}

onAppDomReady(async () => {
  errorInspector.init();
  try {
    await initProviderKeys();
  } catch (err) {
    console.error("Failed to initialize secure provider keys:", err);
  }

  const startPickerNormal = () => import("./shared/elementPicker.js").then(({ elementPicker }) => elementPicker.start(null, false));
  const startPickerScreenshot = () => import("./shared/elementPicker.js").then(({ elementPicker }) => elementPicker.start(null, true));

  let pickerClickTimeout = null;
  const handlePickerClick = () => {
    if (pickerClickTimeout) {
      clearTimeout(pickerClickTimeout);
      pickerClickTimeout = null;
      startPickerScreenshot();
    } else {
      pickerClickTimeout = setTimeout(() => {
        pickerClickTimeout = null;
        startPickerNormal();
      }, 250);
    }
  };

  document.getElementById("btn-activate-sidebar-picker")?.addEventListener("click", handlePickerClick);
  document.getElementById("fab-activate-picker")?.addEventListener("click", handlePickerClick);

  frontendRuntime = setupFrontendRuntime({
    invoke,
    listen,
    getErrorMessage,
    addAppAlert,
    getDiacritizeConfig,
    getActiveApiKey: () => appState.get("activeApiKey"),
    getTextModel: () => appState.get("textModel"),
    getSpeechLanguage: () => appState.get("speechLanguage"),
    getTtsRate: ttsController.getRate,
    getTtsPitch: ttsController.getPitch,
    getTtsVolume: ttsController.getVolume,
    shouldSimulateTyping: () => !!chkSimulateTyping?.checked,
    isTauri: () => isTauri,
    isSelectionMenuEnabled: () => appState.get("selectionFloatingMenuEnabled"),
    isShortcutRecording,
    getSttBehavior: () => normalizeSttShortcutBehavior(appState.get("sttShortcutBehavior")),
    getTextBehavior: () => normalizeTextShortcutBehavior(appState.get("textShortcutBehavior")),
    isRecordingActive: recordingController.isRecordingActive,
    startStt: recordingController.startSttShortcut,
    stopStt: recordingController.stopSttShortcut,
    toggleRecording,
    refreshActiveTab
  });

  if (isTauri) {
    try {
      listen("background-recording-started", () => {
        recordingController.syncDirectDictationUi("recording");
      }).catch(console.error);

      listen("background-recording-stopped", () => {
        recordingController.syncDirectDictationUi("processing");
      }).catch(console.error);

      listen("background-processing-finished", () => {
        recordingController.syncDirectDictationUi("idle");
      }).catch(console.error);

      listen("direct-dictation-text", (event) => {
        const text = typeof event.payload === "string" ? event.payload : event.payload?.text;
        if (!text || !String(text).trim()) return;
        const active = document.activeElement;
        const canInsert = active && (
          active.isContentEditable
          || active.tagName === "TEXTAREA"
          || (active.tagName === "INPUT" && !["button", "checkbox", "radio", "file"].includes(active.type))
        );
        if (canInsert) {
          active.focus();
          document.execCommand("insertText", false, String(text));
        } else {
          applyResultText(String(text));
        }
      }).catch(console.error);

      const warning = await invoke("get_startup_warnings");
      if (warning) {
        console.warn("Startup warning from backend:", warning);
        addAppAlert("warning", "تحذير عند بدء التشغيل", warning, { source: "النظام" });
      }
    } catch (e) {
      console.error("Failed to setup startup configuration or event listeners:", e);
    }
  }

  setupStartupRuntime({
    apiKeyVerification,
    verifyKey,
    setupModelComparison: modelComparison.setup,
    setSpeechLanguage: (value) => { appState.set("speechLanguage", value); },
    updateHomeIndicators,
    updateTTSButtonsState,
    populateVoicesList,
    ttsController,
    getSttShortcutBehavior: () => appState.get("sttShortcutBehavior"),
    setSttShortcutBehavior: (value) => { appState.set("sttShortcutBehavior", value); },
    getTextShortcutBehavior: () => appState.get("textShortcutBehavior"),
    setTextShortcutBehavior: (value) => { appState.set("textShortcutBehavior", value); },
    currentShortcutBehavior,
    clearSpaceHoldTimer,
    setAutoDiacritize: (value) => { appState.set("autoDiacritize", value); },
    setAutoGrammar: (value) => { appState.set("autoGrammar", value); },
    setVoiceTranslation: (value) => { appState.set("voiceTranslation", value); },
    diacritizeCurrentResultText,
    getSelectionFloatingMenuEnabled: () => appState.get("selectionFloatingMenuEnabled"),
    setSelectionMonitorEnabled: frontendRuntime.setSelectionMonitorEnabled,
    setSelectionFloatingMenuEnabled: (value) => { appState.set("selectionFloatingMenuEnabled", value); },
    getTextOutputTarget: () => appState.get("textOutputTarget"),
    setTextOutputTarget: (value) => { appState.set("textOutputTarget", value); },
    getLiveTranscriptionEnabled: () => appState.get("liveTranscriptionEnabled"),
    setLiveTranscriptionEnabled: (value) => { appState.set("liveTranscriptionEnabled", value); },
    setAppendMode: (value) => { appState.set("appendMode", value); },
    getAppendSeparator: () => appState.get("appendSeparator"),
    setAppendSeparator: (value) => { appState.set("appendSeparator", value); },
    forceHideQuickTools: frontendRuntime.forceHideQuickTools,
    getFreeSttEngine: () => appState.get("freeSttEngine"),
    setFreeSttEngine: (value) => { appState.set("freeSttEngine", value); },
    getActiveApiKey: () => appState.get("activeApiKey"),
    getActiveProvider: () => appState.get("activeProvider"),
    setActiveProvider: (value) => { appState.set("activeProvider", value); },
    populateModels,
    getDiacritizeProvider: () => appState.get("diacritizeProvider"),
    populateDiacritizeModels
  });
});
