export function setupHomeSpeechActions(refs, deps) {
  const {
    btnCopy,
    btnClearText,
    btnSpeak,
    btnPauseSpeak,
    btnStopSpeak,
    btnDownloadSpeak,
    resultText,
    recordStatus
  } = refs;

  btnCopy?.addEventListener("click", () => {
    navigator.clipboard.writeText(deps.getResultText());
    alert("تم نسخ النص للحافظة.");
  });

  btnClearText?.addEventListener("click", () => {
    deps.setResultText("");
    resultText?.focus();
  });

  btnSpeak?.addEventListener("click", async () => {
    const text = deps.getResultText().trim();
    if (!text) {
      if (recordStatus) recordStatus.textContent = "⚠️ لا يوجد نص لنطقه.";
      return;
    }

    await deps.speakHomeText(text);
  });

  btnPauseSpeak?.addEventListener("click", () => {
    const provider = deps.getSelectedTtsProvider();
    if (provider === "sapi5") {
      if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        } else {
          window.speechSynthesis.pause();
        }
      }
      return;
    }

    const activeAudio = deps.getActiveAudio();
    if (activeAudio) {
      if (activeAudio.paused) {
        activeAudio.play();
      } else {
        activeAudio.pause();
      }
    }
  });

  btnStopSpeak?.addEventListener("click", () => {
    deps.bumpTtsPlaybackRequest();
    const provider = deps.getSelectedTtsProvider();
    if (provider === "sapi5") {
      window.speechSynthesis.cancel();
      deps.updateTTSButtonsState("stopped");
      return;
    }

    const activeAudio = deps.getActiveAudio();
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    deps.updateTTSButtonsState("stopped");
  });

  btnDownloadSpeak?.addEventListener("click", () => {
    const activeAudioSrc = deps.getActiveAudioSrc();
    if (!activeAudioSrc) return;

    const link = document.createElement("a");
    link.href = activeAudioSrc;
    link.download = "speech_audio.mp3";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}
