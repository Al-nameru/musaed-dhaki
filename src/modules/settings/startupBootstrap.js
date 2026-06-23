import { collectMainDomRefs } from "./domRefs.js";
import { setupStartupWiring } from "./startupWiring.js";

export function setupStartupBootstrap(deps) {
  const refs = collectMainDomRefs();

  setupStartupWiring({
    selectProviderCompany: refs.selectProviderCompany,
    apiKeyInput: refs.apiKeyInput,
    selectSpeechLanguage: refs.selectSpeechLanguage,
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
    displayTtsVolume: refs.displayTtsVolume,
    chkHomeAutoDiacritize: refs.chkHomeAutoDiacritize,
    chkSettingsAutoDiacritize: refs.chkSettingsAutoDiacritize,
    chkHomeAutoGrammar: refs.chkHomeAutoGrammar,
    chkSettingsAutoGrammar: refs.chkSettingsAutoGrammar,
    chkSelectionFloatingMenu: refs.chkSelectionFloatingMenu,
    selectOutputTarget: refs.selectOutputTarget,
    chkLiveTranscription: refs.chkLiveTranscription,
    selectTextInsertionMode: refs.selectTextInsertionMode,
    selectFreeSttEngine: refs.selectFreeSttEngine,
    freeSttStatusMsg: refs.freeSttStatusMsg,
    selectSttShortcutBehavior: refs.selectSttShortcutBehavior,
    chkBackgroundRecording: refs.chkBackgroundRecording,
    selectTextShortcutBehavior: refs.selectTextShortcutBehavior,
    selectDiacritizeProvider: refs.selectDiacritizeProvider
  }, deps);
}
