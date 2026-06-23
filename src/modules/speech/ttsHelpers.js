export function getSelectedTtsProvider({ homeProviderSelect, settingsProviderSelect }) {
  return homeProviderSelect?.value || settingsProviderSelect?.value || "sapi5";
}

export function getSelectedTtsVoice({ homeVoiceSelect, settingsVoiceSelect, voices }) {
  const voiceVal = homeVoiceSelect?.value || settingsVoiceSelect?.value || "default";
  if (voiceVal === "default") return null;

  const index = Number.parseInt(voiceVal, 10);
  return Number.isInteger(index) ? voices[index] || null : null;
}

export function detectSpeechLanguage(text) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar-EG";
  if (/[äöüß]/i.test(text)) return "de-DE";
  if (/[àâçéèêëîïôùûüÿœ]/i.test(text)) return "fr-FR";
  return "en-US";
}

export function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export function updateTTSButtonsState(state, refs) {
  const {
    btnSpeak,
    btnPauseSpeak,
    btnStopSpeak,
    btnDownloadSpeak,
    isSapi5,
    activeAudioSrc
  } = refs;

  const isPlaying = state === "playing";
  const isPaused = state === "paused";
  const isStopped = !isPlaying && !isPaused;

  if (btnSpeak) {
    btnSpeak.disabled = isPlaying || isPaused;
  }
  if (btnPauseSpeak) {
    btnPauseSpeak.textContent = isPaused ? "▶️ استئناف" : "⏸️ مؤقت";
    btnPauseSpeak.disabled = isStopped;
  }
  if (btnStopSpeak) {
    btnStopSpeak.disabled = isStopped;
  }
  if (btnDownloadSpeak) {
    btnDownloadSpeak.disabled = !!(isSapi5 || !activeAudioSrc);
  }
}
