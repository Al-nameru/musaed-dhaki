import {
  getSelectedTtsProvider as resolveSelectedTtsProvider,
  getSelectedTtsVoice as resolveSelectedTtsVoice,
  updateTTSButtonsState as renderTTSButtonsState,
  withTimeout
} from "./ttsHelpers.js";
import { populateVoiceSelects } from "./ttsVoices.js";
import {
  speakWithCloudProvider as speakWithCloudProviderAudio,
  speakWithSystemVoice as speakWithSystemVoiceAudio
} from "./ttsPlayback.js";

export function createTtsRuntime(deps) {
  const getSelectedTtsProvider = () => {
    const refs = deps.getRefs();
    return resolveSelectedTtsProvider({
      homeProviderSelect: refs.homeSelectTtsProvider,
      settingsProviderSelect: refs.selectTtsProvider
    });
  };

  const getSelectedTtsVoice = () => {
    const refs = deps.getRefs();
    return resolveSelectedTtsVoice({
      homeVoiceSelect: refs.selectHomeTtsVoice,
      settingsVoiceSelect: refs.selectTtsVoice,
      voices: deps.getVoices()
    });
  };

  const updateTTSButtonsState = (state) => {
    const refs = deps.getRefs();
    renderTTSButtonsState(state, {
      btnSpeak: refs.btnSpeak,
      btnPauseSpeak: refs.btnPauseSpeak,
      btnStopSpeak: refs.btnStopSpeak,
      btnDownloadSpeak: refs.btnDownloadSpeak,
      isSapi5: getSelectedTtsProvider() === "sapi5",
      activeAudioSrc: deps.getActiveAudioSrc()
    });
  };

  const speakWithSystemVoice = (text, { announceFallback = false } = {}) => {
    speakWithSystemVoiceAudio(text, { announceFallback }, {
      stopActiveAudio: () => {
        const activeAudio = deps.getActiveAudio();
        if (activeAudio) {
          activeAudio.pause();
          deps.setActiveAudio(null);
        }
      },
      setActiveAudioSrc: deps.setActiveAudioSrc,
      getSelectedVoice: getSelectedTtsVoice,
      getRate: deps.getRate,
      getPitch: deps.getPitch,
      getVolume: deps.getVolume,
      announceFallback: () => {
        const { recordStatus } = deps.getRefs();
        if (recordStatus) recordStatus.textContent = "🔊 تم تشغيل النطق المحلي كبديل.";
      },
      updateButtonsState: updateTTSButtonsState,
      onWordHighlight: deps.onWordHighlight,
      onWordHighlightClean: deps.onWordHighlightClean
    });
  };

  const speakWithCloudProvider = async (text, provider, requestId) => {
    await speakWithCloudProviderAudio(text, provider, requestId, {
      invoke: deps.invoke,
      stopActiveAudio: () => {
        const activeAudio = deps.getActiveAudio();
        if (activeAudio) {
          activeAudio.pause();
          deps.setActiveAudio(null);
        }
      },
      setActiveAudioSrc: deps.setActiveAudioSrc,
      setActiveAudio: deps.setActiveAudio,
      getRate: deps.getRate,
      getVolume: deps.getVolume,
      isCurrentRequest: (id) => id === deps.getPlaybackRequestId(),
      updateButtonsState: updateTTSButtonsState,
      onWordHighlight: deps.onWordHighlight,
      onWordHighlightClean: deps.onWordHighlightClean
    });
  };

  const speakHomeText = async (text) => {
    const provider = getSelectedTtsProvider();
    const requestId = deps.bumpPlaybackRequestId();
    updateTTSButtonsState("playing");

    if (provider === "sapi5") {
      try {
        speakWithSystemVoice(text);
      } catch (err) {
        updateTTSButtonsState("stopped");
        alert("فشل نطق النص: " + deps.getErrorMessage(err));
      }
      return;
    }

    try {
      await withTimeout(
        speakWithCloudProvider(text, provider, requestId),
        6000,
        "انتهت مهلة النطق السحابي."
      );
    } catch (err) {
      deps.bumpPlaybackRequestId();
      console.error("Cloud TTS failed, falling back to local speech:", err);
      deps.addAppAlert("warning", "فشل النطق السحابي", "سيتم استخدام النطق المحلي بدلًا منه: " + deps.getErrorMessage(err), {
        source: "نطق النص"
      });
      try {
        speakWithSystemVoice(text, { announceFallback: true });
      } catch (fallbackErr) {
        updateTTSButtonsState("stopped");
        alert("فشل نطق النص: " + deps.getErrorMessage(fallbackErr));
      }
    }
  };

  const populateVoicesList = () => {
    const refs = deps.getRefs();
    const result = populateVoiceSelects({
      homeVoiceSelect: refs.selectHomeTtsVoice,
      settingsVoiceSelect: refs.selectTtsVoice
    });
    deps.setVoices(result.voices);
    if (result.selectedVoiceName) {
      deps.setVoiceName(result.selectedVoiceName);
    }
  };

  return {
    updateTTSButtonsState,
    getSelectedTtsProvider,
    getSelectedTtsVoice,
    speakWithSystemVoice,
    speakWithCloudProvider,
    speakHomeText,
    populateVoicesList
  };
}
