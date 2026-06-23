function playTonePair(first, second, errorLabel) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = "sine";
    osc1.frequency.value = first.frequency;
    gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + first.duration);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + first.duration);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = "sine";
    osc2.frequency.value = second.frequency;
    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + first.duration);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + first.duration + second.duration);
    osc2.start(audioCtx.currentTime + first.duration);
    osc2.stop(audioCtx.currentTime + first.duration + second.duration);
  } catch (err) {
    console.error(errorLabel, err);
  }
}

export function playBeepSound() {
  playTonePair(
    { frequency: 520, duration: 0.08 },
    { frequency: 650, duration: 0.12 },
    "Failed to play beep sound:"
  );
}

export function playStopBeepSound() {
  playTonePair(
    { frequency: 660, duration: 0.09 },
    { frequency: 440, duration: 0.14 },
    "Failed to play stop beep sound:"
  );
}
