import { createCloudRecordingSession } from "./cloudRecordingSession.js";
import { processAudioTranscriptionBlob } from "./cloudTranscription.js";
import { createSttShortcutBridge } from "./sttShortcutBridge.js";
import { createWebSpeechController } from "./webSpeechController.js";

/**
 * @typedef {Object} RecordingControllerDeps
 * @property {Function} invoke - Tauri invoke command helper
 * @property {boolean} isTauri - Boolean flag indicating if Tauri environment is present
 * @property {Function} captureExternalTarget - Captures the currently active window or input element
 * @property {Function} getResultText - Gets current text inside main result field
 * @property {Function} isAppendModeEnabled - Checks if append mode is active
 * @property {Function} setResultText - Sets the result text inside main field
 * @property {Function} addAppAlert - Triggers app notifications/toasts
 * @property {Function} playBeepSound - Plays start beep sound cue
 * @property {Function} playStopBeepSound - Plays stop beep sound cue
 * @property {Function} applyAutomaticTextProcessing - Passes output to AI post processing
 * @property {Function} resolveTextOutputRoute - Resolves where the text should go
 * @property {Function} writeTextToExternalTarget - Sends text to other windows
 * @property {Function} getDiacritizeConfig - Fetches current diacritization settings
 * @property {Function} getActiveApiKey - Returns current AI provider API key
 * @property {Function} getActiveProvider - Returns current AI provider string
 * @property {Function} getSpeechModel - Returns active STT model
 * @property {Function} getSpeechLanguage - Returns current speech recognition language
 * @property {Function} getAutoGrammar - Returns auto-grammar status boolean
 * @property {Function} getAutoDiacritize - Returns auto-diacritize status boolean
 * @property {Function} getTextModel - Returns active text AI model
 * @property {Function} getTextOutputTarget - Returns "both" | "external" | "internal"
 * @property {Function} getExternalTargetCaptured - Was target captured?
 * @property {Function} getLiveTranscriptionEnabled - Is live speech text feedback on?
 * @property {Function} getFreeSttEngine - returns "none" | "google" etc
 * @property {Function} applyResultText - Applies text result dynamically
 * @property {Function} shouldSimulateTyping - Should type out text physically
 * @property {Function} setSuppressResultTextInput - Control frontend events suppression
 * @property {Function} setLastAutoDiacritizeSource - Keeps track of source for diacritization
 * @property {Function} getRecordButton - returns recording button element
 * @property {Function} getRecordStatus - returns status feedback text element
 * @property {Function} getVoiceTranslationEnabled - Translate voice text into target language?
 * @property {Function} speakText - Text to Speech playback function
 */

/**
 * Creates and manages the recording process controls (speech-to-text integration).
 * @param {RecordingControllerDeps} deps
 */
export function createRecordingController(deps) {
  let isRecording = false;
  let recognitionInstance = null;
  let recordingState = "idle";
  let manualStopRequested = false;
  let ignoreRecordingToggleUntil = 0;
  let webSpeechShouldListen = false;
  let webSpeechFinal = "";
  let webSpeechBase = "";

  const isRecordingActive = () => isRecording || recordingState === "recording" || recordingState === "starting";
  const setRecordButtonRecording = (value) => deps.getRecordButton().classList.toggle("recording", value);
  const setStatus = (message) => {
    deps.getRecordStatus().textContent = message;
    const island = document.getElementById("dynamic-island");
    const islandStatus = document.getElementById("island-status");
    if (island && islandStatus) {
      islandStatus.textContent = message;
      island.classList.remove("recording", "processing");
      if (message.includes("استماع") || message.includes("تسجيل")) {
        island.classList.add("active", "recording");
      } else if (message.includes("معالجة") || message.includes("تحويل") || message.includes("ترجمة") || message.includes("تصحيح")) {
        island.classList.add("active", "processing");
      } else if (message.includes("جاهز") || message.includes("تم") || message.includes("فشل") || message.includes("إلغاء")) {
        setTimeout(() => {
          if (!isRecordingActive() && (deps.getRecordStatus().textContent.includes("جاهز") || deps.getRecordStatus().textContent.includes("تم") || deps.getRecordStatus().textContent.includes("إلغاء"))) {
            island.classList.remove("active");
          }
        }, 2000);
      } else {
        island.classList.add("active");
      }
    }
  };
  const getStatus = () => deps.getRecordStatus().textContent;

  async function processAudioTranscription(blob) {
    return processAudioTranscriptionBlob(blob, {
      invoke: deps.invoke,
      isTauri: deps.isTauri,
      getActiveApiKey: deps.getActiveApiKey,
      getActiveProvider: deps.getActiveProvider,
      getSpeechModel: deps.getSpeechModel,
      getSpeechLanguage: deps.getSpeechLanguage,
      getAutoGrammar: deps.getAutoGrammar,
      getAutoDiacritize: deps.getAutoDiacritize,
      getTextModel: deps.getTextModel,
      getTextOutputTarget: deps.getTextOutputTarget,
      getExternalTargetCaptured: deps.getExternalTargetCaptured,
      getDiacritizeConfig: deps.getDiacritizeConfig,
      applyAutomaticTextProcessing: deps.applyAutomaticTextProcessing,
      resolveTextOutputRoute: deps.resolveTextOutputRoute,
      writeTextToExternalTarget: deps.writeTextToExternalTarget,
      applyResultText: deps.applyResultText,
      shouldSimulateTyping: deps.shouldSimulateTyping,
      setStatus,
      addAppAlert: deps.addAppAlert,
      getVoiceTranslationEnabled: deps.getVoiceTranslationEnabled,
      speakText: deps.speakText
    });
  }

  const cloudRecordingSession = createCloudRecordingSession({
    isTauri: deps.isTauri,
    captureExternalTarget: deps.captureExternalTarget,
    playBeepSound: deps.playBeepSound,
    playStopBeepSound: deps.playStopBeepSound,
    processAudioTranscription,
    isAppendModeEnabled: deps.isAppendModeEnabled,
    setResultText: deps.setResultText,
    addAppAlert: deps.addAppAlert,
    getRecordingState: () => recordingState,
    setRecordingState: (value) => { recordingState = value; },
    getManualStopRequested: () => manualStopRequested,
    setManualStopRequested: (value) => { manualStopRequested = value; },
    getIsRecording: () => isRecording,
    setIsRecording: (value) => { isRecording = value; },
    setIgnoreRecordingToggleUntil: (value) => { ignoreRecordingToggleUntil = value; },
    getActiveProvider: deps.getActiveProvider,
    getActiveApiKey: deps.getActiveApiKey,
    setRecordButtonRecording,
    setLastAutoDiacritizeSource: deps.setLastAutoDiacritizeSource,
    setStatus
  });

  const webSpeechController = createWebSpeechController({
    invoke: deps.invoke,
    isTauri: deps.isTauri,
    captureExternalTarget: deps.captureExternalTarget,
    getResultText: deps.getResultText,
    isAppendModeEnabled: deps.isAppendModeEnabled,
    setResultText: deps.setResultText,
    applyResultText: deps.applyResultText,
    addAppAlert: deps.addAppAlert,
    playBeepSound: deps.playBeepSound,
    playStopBeepSound: deps.playStopBeepSound,
    applyAutomaticTextProcessing: deps.applyAutomaticTextProcessing,
    resolveTextOutputRoute: deps.resolveTextOutputRoute,
    writeTextToExternalTarget: deps.writeTextToExternalTarget,
    getDiacritizeConfig: deps.getDiacritizeConfig,
    isRecordingActive,
    getRecordingState: () => recordingState,
    setRecordingState: (value) => { recordingState = value; },
    setManualStopRequested: (value) => { manualStopRequested = value; },
    setIgnoreRecordingToggleUntil: (value) => { ignoreRecordingToggleUntil = value; },
    setIsRecording: (value) => { isRecording = value; },
    setRecordButtonRecording,
    getRecognitionInstance: () => recognitionInstance,
    setRecognitionInstance: (value) => { recognitionInstance = value; },
    getWebSpeechShouldListen: () => webSpeechShouldListen,
    setWebSpeechShouldListen: (value) => { webSpeechShouldListen = value; },
    getWebSpeechBase: () => webSpeechBase,
    setWebSpeechBase: (value) => { webSpeechBase = value; },
    getWebSpeechFinal: () => webSpeechFinal,
    setWebSpeechFinal: (value) => { webSpeechFinal = value; },
    appendWebSpeechFinal: (value) => { webSpeechFinal += value; },
    getTextOutputTarget: deps.getTextOutputTarget,
    getLiveTranscriptionEnabled: deps.getLiveTranscriptionEnabled,
    getSpeechLanguage: deps.getSpeechLanguage,
    setSuppressResultTextInput: deps.setSuppressResultTextInput,
    setLastAutoDiacritizeSource: deps.setLastAutoDiacritizeSource,
    getStatus,
    setStatus,
    getAutoGrammar: deps.getAutoGrammar,
    getAutoDiacritize: deps.getAutoDiacritize,
    getActiveApiKey: deps.getActiveApiKey,
    getTextModel: deps.getTextModel,
    getExternalTargetCaptured: deps.getExternalTargetCaptured,
    shouldSimulateTyping: deps.shouldSimulateTyping,
    getTextInsertionMode: deps.getTextInsertionMode
  });

  async function toggleFreeSpeechRecognition(isShortcut = false) {
    return webSpeechController.toggle(isShortcut);
  }

  async function startRecording(isShortcut = false) {
    return cloudRecordingSession.startRecording(isShortcut);
  }

  function stopRecording() {
    return cloudRecordingSession.stopRecording();
  }

  async function toggleRecording(isShortcut = false) {
    if (Date.now() < ignoreRecordingToggleUntil || recordingState === "stopping" || recordingState === "starting") {
      return;
    }

    if (deps.getFreeSttEngine() !== "none") {
      await toggleFreeSpeechRecognition(isShortcut);
      return;
    }

    if (isRecordingActive()) {
      stopRecording();
    } else {
      await startRecording(isShortcut);
    }
  }

  const sttShortcutBridge = createSttShortcutBridge({
    isRecording: () => isRecording,
    getRecordingState: () => recordingState,
    getFreeSttEngine: deps.getFreeSttEngine,
    toggleFreeSpeechRecognition,
    startRecording,
    stopRecording
  });

  function syncDirectDictationUi(phase) {
    if (phase === "recording") {
      isRecording = true;
      recordingState = "recording";
      setRecordButtonRecording(true);
      setStatus("🎙️ جاري التسجيل بالخلفية...");
      return;
    }
    if (phase === "processing") {
      isRecording = false;
      recordingState = "idle";
      setRecordButtonRecording(false);
      setStatus("⏳ جاري تفريغ الصوت وتحليله...");
      return;
    }
    isRecording = false;
    recordingState = "idle";
    setRecordButtonRecording(false);
    setStatus("جاهز للبدء");
  }

  return {
    toggleRecording,
    startRecording,
    stopRecording,
    processAudioTranscription,
    toggleFreeSpeechRecognition,
    isRecordingActive,
    getRecordingState: () => recordingState,
    startSttShortcut: sttShortcutBridge.start,
    stopSttShortcut: sttShortcutBridge.stop,
    syncDirectDictationUi
  };
}
