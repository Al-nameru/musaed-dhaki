import { collectMainDomRefs } from "./domRefs.js";
import { attachInitialDomListeners } from "./initialDomListeners.js";

export function attachInitialDomListenersFromDocument(deps) {
  const refs = collectMainDomRefs();

  attachInitialDomListeners({
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
    homeSelectTtsProvider: refs.homeSelectTtsProvider,
    btnCopy: refs.btnCopy,
    btnClearText: refs.btnClearText,
    btnSpeak: refs.btnSpeak,
    btnPauseSpeak: refs.btnPauseSpeak,
    btnStopSpeak: refs.btnStopSpeak,
    btnDownloadSpeak: refs.btnDownloadSpeak,
    resultText: refs.resultText,
    recordStatus: refs.recordStatus
  }, deps);
}
