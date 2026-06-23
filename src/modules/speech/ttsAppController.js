import { collectTtsRuntimeRefs } from "./ttsDomRefs.js";
import { createTtsRuntime } from "./ttsRuntime.js";

export function createTtsAppController({ invoke, getErrorMessage, addAppAlert, onWordHighlight, onWordHighlightClean }) {
  let ttsRate = 1.0;
  let ttsPitch = 1.0;
  let ttsVolume = 1.0;
  let ttsVoiceName = "";
  let voices = [];
  let activeAudio = null;
  let activeAudioSrc = "";
  let playbackRequestId = 0;

  const runtime = createTtsRuntime({
    invoke,
    getErrorMessage,
    addAppAlert,
    getRefs: collectTtsRuntimeRefs,
    getVoices: () => voices,
    setVoices: (value) => { voices = value; },
    setVoiceName: (value) => { ttsVoiceName = value; },
    getRate: () => ttsRate,
    getPitch: () => ttsPitch,
    getVolume: () => ttsVolume,
    getActiveAudio: () => activeAudio,
    setActiveAudio: (value) => { activeAudio = value; },
    getActiveAudioSrc: () => activeAudioSrc,
    setActiveAudioSrc: (value) => { activeAudioSrc = value; },
    getPlaybackRequestId: () => playbackRequestId,
    bumpPlaybackRequestId: () => {
      playbackRequestId += 1;
      return playbackRequestId;
    },
    onWordHighlight,
    onWordHighlightClean
  });

  return {
    updateButtonsState: runtime.updateTTSButtonsState,
    getSelectedProvider: runtime.getSelectedTtsProvider,
    speakHomeText: runtime.speakHomeText,
    populateVoicesList: runtime.populateVoicesList,
    getRate: () => ttsRate,
    setRate: (value) => { ttsRate = value; },
    getPitch: () => ttsPitch,
    setPitch: (value) => { ttsPitch = value; },
    getVolume: () => ttsVolume,
    setVolume: (value) => { ttsVolume = value; },
    setVoiceName: (value) => { ttsVoiceName = value; },
    getVoices: () => voices,
    getActiveAudio: () => activeAudio,
    getActiveAudioSrc: () => activeAudioSrc,
    bumpPlaybackRequest: () => {
      playbackRequestId += 1;
      return playbackRequestId;
    }
  };
}
