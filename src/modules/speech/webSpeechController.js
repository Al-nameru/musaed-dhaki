import { toggleFreeSpeechRecognitionFlow } from "./webSpeechSession.js";
import { finalizeWebSpeechSessionFlow } from "./webSpeechFinalize.js";

export function createWebSpeechController(deps) {
  let webSpeechOriginalText = "";

  const finalize = () => finalizeWebSpeechSessionFlow({
    invoke: deps.invoke,
    isTauri: deps.isTauri,
    playStopBeepSound: deps.playStopBeepSound,
    applyAutomaticTextProcessing: deps.applyAutomaticTextProcessing,
    resolveTextOutputRoute: deps.resolveTextOutputRoute,
    writeTextToExternalTarget: deps.writeTextToExternalTarget,
    getDiacritizeConfig: deps.getDiacritizeConfig,
    addAppAlert: deps.addAppAlert,
    getWebSpeechFinal: deps.getWebSpeechFinal,
    getWebSpeechBase: deps.getWebSpeechBase,
    getWebSpeechOriginalText: () => webSpeechOriginalText,
    setWebSpeechOriginalText: (val) => { webSpeechOriginalText = val; },
    getStatus: deps.getStatus,
    setStatus: deps.setStatus,
    getAutoGrammar: deps.getAutoGrammar,
    getAutoDiacritize: deps.getAutoDiacritize,
    getActiveApiKey: deps.getActiveApiKey,
    getTextModel: deps.getTextModel,
    getTextOutputTarget: deps.getTextOutputTarget,
    getExternalTargetCaptured: deps.getExternalTargetCaptured,
    setIsRecording: deps.setIsRecording,
    setRecordingState: deps.setRecordingState,
    setManualStopRequested: deps.setManualStopRequested,
    setRecognitionInstance: deps.setRecognitionInstance,
    setRecordButtonRecording: deps.setRecordButtonRecording,
    setSuppressResultTextInput: deps.setSuppressResultTextInput,
    setResultText: deps.setResultText,
    applyResultText: deps.applyResultText,
    getTextInsertionMode: deps.getTextInsertionMode,
    setLastAutoDiacritizeSource: deps.setLastAutoDiacritizeSource,
    shouldSimulateTyping: deps.shouldSimulateTyping
  });

  const toggle = (isShortcut = false) => toggleFreeSpeechRecognitionFlow({
    captureExternalTarget: deps.captureExternalTarget,
    getResultText: deps.getResultText,
    isAppendModeEnabled: deps.isAppendModeEnabled,
    setResultText: deps.setResultText,
    finalizeWebSpeechSession: finalize,
    addAppAlert: deps.addAppAlert,
    playBeepSound: deps.playBeepSound,
    isRecordingActive: deps.isRecordingActive,
    getRecordingState: deps.getRecordingState,
    setRecordingState: deps.setRecordingState,
    setManualStopRequested: deps.setManualStopRequested,
    setIgnoreRecordingToggleUntil: deps.setIgnoreRecordingToggleUntil,
    setIsRecording: deps.setIsRecording,
    setRecordButtonRecording: deps.setRecordButtonRecording,
    getRecognitionInstance: deps.getRecognitionInstance,
    setRecognitionInstance: deps.setRecognitionInstance,
    getWebSpeechShouldListen: deps.getWebSpeechShouldListen,
    setWebSpeechShouldListen: deps.setWebSpeechShouldListen,
    getWebSpeechBase: deps.getWebSpeechBase,
    setWebSpeechBase: deps.setWebSpeechBase,
    getWebSpeechOriginalText: () => webSpeechOriginalText,
    setWebSpeechOriginalText: (val) => { webSpeechOriginalText = val; },
    getWebSpeechFinal: deps.getWebSpeechFinal,
    setWebSpeechFinal: deps.setWebSpeechFinal,
    appendWebSpeechFinal: deps.appendWebSpeechFinal,
    getTextOutputTarget: deps.getTextOutputTarget,
    getLiveTranscriptionEnabled: deps.getLiveTranscriptionEnabled,
    getSpeechLanguage: deps.getSpeechLanguage,
    setSuppressResultTextInput: deps.setSuppressResultTextInput,
    setLastAutoDiacritizeSource: deps.setLastAutoDiacritizeSource,
    setStatus: deps.setStatus,
    getTextInsertionMode: deps.getTextInsertionMode,
    isShortcut
  });

  return { toggle, finalize };
}
