import { loadFailedKeys, loadSavedBatchKeys } from "../modules/apiKeys/batchKeys.js";
import { setupAutoProcessingControls } from "../modules/ai/autoProcessingControls.js";
import { setupPromptSettings } from "../modules/ai/promptSettings.js";
import { setupShortcutBehaviorControls } from "../modules/shortcuts/behaviorControls.js";
import { loadAndRegisterShortcuts, setupShortcutEditor } from "../modules/shortcuts/editor.js";
import { setupFreeSttControls } from "../modules/speech/freeSttControls.js";
import { setupTtsControls } from "../modules/speech/ttsControls.js";
import { loadStartupPreferences } from "../modules/settings/startupPreferences.js";
import { setupStartupBootstrap } from "../modules/settings/startupBootstrap.js";
import { setupTextOutputControls } from "../modules/settings/textOutputControls.js";

/**
 * @typedef {Object} StartupRuntimeDeps
 * @property {Object} apiKeyVerification - Helper object for AI API key checks
 * @property {Function} verifyKey - Verification callback
 * @property {Function} setupModelComparison - Callback to initialize comparison feature
 * @property {Function} setSpeechLanguage - Language change handler
 * @property {Function} updateHomeIndicators - Updates Home UI indicators state
 * @property {Function} updateTTSButtonsState - Updates TTS play/stop status
 * @property {Function} populateVoicesList - Populates voices list in UI
 * @property {Object} ttsController - Controls TTS execution
 * @property {Function} getSttShortcutBehavior - Returns STT key shortcut behavior
 * @property {Function} setSttShortcutBehavior - Saves STT key shortcut behavior
 * @property {Function} getTextShortcutBehavior - Returns Text key shortcut behavior
 * @property {Function} setTextShortcutBehavior - Saves Text key shortcut behavior
 * @property {Function} currentShortcutBehavior - Returns active shortcut handler behavior
 * @property {Function} clearSpaceHoldTimer - Callback to stop space key hold timer
 * @property {Function} setAutoDiacritize - Updates auto diacritize flag
 * @property {Function} setAutoGrammar - Updates auto grammar correction flag
 * @property {Function} diacritizeCurrentResultText - Diacritization action handler
 * @property {Function} setVoiceTranslation - Updates voice translation flag
 * @property {Function} getSelectionFloatingMenuEnabled - Check if floating menu is enabled
 * @property {Function} setSelectionFloatingMenuEnabled - Save floating menu enabled state
 * @property {Function} getTextOutputTarget - Gets "both" | "external" | "internal"
 * @property {Function} setTextOutputTarget - Saves output target setting
 * @property {Function} getLiveTranscriptionEnabled - Checks if live transcription is on
 * @property {Function} setLiveTranscriptionEnabled - Saves live transcription state
 * @property {Function} setAppendMode - Saves append mode setting
 * @property {Function} setSelectionMonitorEnabled - Control active selection monitoring
 * @property {Function} forceHideQuickTools - Physical UI helper to close quick tools
 * @property {Function} getFreeSttEngine - Returns active free STT provider name
 * @property {Function} setFreeSttEngine - Saves free STT setting
 * @property {Function} getActiveApiKey - Returns current provider API key
 * @property {Function} getActiveProvider - Returns current provider string
 * @property {Function} setActiveProvider - Saves active provider setting
 * @property {Function} populateModels - Fills active model choices in UI select elements
 * @property {Function} toggleModelsCardVisibility - Visual UI settings logic
 * @property {Function} getDiacritizeProvider - Returns diacritize provider setting
 * @property {Function} populateDiacritizeModels - Populates diacritize models dropdown
 */

/**
 * Initializes and wires all application controls and startup logic.
 * @param {StartupRuntimeDeps} deps - Global startup runtime dependencies
 */
export function setupStartupRuntime(deps) {
  setupStartupBootstrap({
    loadStartupPreferences,
    activateGoogleSpeechProvider: deps.apiKeyVerification.activateGoogleSpeechProvider,
    verifyKey: deps.verifyKey,
    loadSavedBatchKeys,
    loadFailedKeys,
    setupModelComparison: deps.setupModelComparison,
    setSpeechLanguage: deps.setSpeechLanguage,
    setupTtsControls,
    updateHomeIndicators: deps.updateHomeIndicators,
    updateTTSButtonsState: deps.updateTTSButtonsState,
    populateVoicesList: deps.populateVoicesList,
    getActiveAudio: deps.ttsController.getActiveAudio,
    getVoices: deps.ttsController.getVoices,
    setTtsRate: deps.ttsController.setRate,
    setTtsPitch: deps.ttsController.setPitch,
    setTtsVolume: deps.ttsController.setVolume,
    setTtsVoiceName: deps.ttsController.setVoiceName,
    loadAndRegisterShortcuts,
    getSttShortcutBehavior: deps.getSttShortcutBehavior,
    setSttShortcutBehavior: deps.setSttShortcutBehavior,
    getTextShortcutBehavior: deps.getTextShortcutBehavior,
    setTextShortcutBehavior: deps.setTextShortcutBehavior,
    setupShortcutEditor,
    currentShortcutBehavior: deps.currentShortcutBehavior,
    clearSpaceHoldTimer: deps.clearSpaceHoldTimer,
    setupAutoProcessingControls,
    setAutoDiacritize: deps.setAutoDiacritize,
    setAutoGrammar: deps.setAutoGrammar,
    diacritizeCurrentResultText: deps.diacritizeCurrentResultText,
    setVoiceTranslation: deps.setVoiceTranslation,
    setupTextOutputControls,
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
    forceHideQuickTools: deps.forceHideQuickTools,
    setupFreeSttControls,
    getFreeSttEngine: deps.getFreeSttEngine,
    setFreeSttEngine: deps.setFreeSttEngine,
    getActiveApiKey: deps.getActiveApiKey,
    getActiveProvider: deps.getActiveProvider,
    setActiveProvider: deps.setActiveProvider,
    populateModels: deps.populateModels,
    toggleModelsCardVisibility: deps.apiKeyVerification.toggleModelsCardVisibility,
    setupShortcutBehaviorControls,
    getDiacritizeProvider: deps.getDiacritizeProvider,
    populateDiacritizeModels: deps.populateDiacritizeModels,
    setupPromptSettings
  });
}
