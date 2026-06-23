export function collectTtsRuntimeRefs() {
  return {
    homeSelectTtsProvider: document.getElementById("home-select-tts-provider"),
    selectTtsProvider: document.getElementById("select-tts-provider"),
    selectHomeTtsVoice: document.getElementById("select-home-tts-voice"),
    selectTtsVoice: document.getElementById("select-tts-voice"),
    btnSpeak: document.getElementById("btn-speak"),
    btnPauseSpeak: document.getElementById("btn-pause-speak"),
    btnStopSpeak: document.getElementById("btn-stop-speak"),
    btnDownloadSpeak: document.getElementById("btn-download-speak"),
    recordStatus: document.getElementById("record-status")
  };
}
