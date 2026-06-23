import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

function syncClosestOption(select, value, tolerance = 0.15) {
  if (!select) return;
  const closestOption = [...select.options]
    .map(opt => ({ opt, diff: Math.abs(parseFloat(opt.value) - value) }))
    .sort((a, b) => a.diff - b.diff)[0];
  if (closestOption && closestOption.diff < tolerance) {
    select.value = closestOption.opt.value;
  }
}

function persistVoiceSelection(value, refs, deps) {
  const { selectHomeTtsVoice, selectTtsVoice } = refs;
  if (selectHomeTtsVoice) selectHomeTtsVoice.value = value;
  if (selectTtsVoice) selectTtsVoice.value = value;

  if (value === "default") {
    stateStore.removeItem(StorageKeys.TTS_VOICE_NAME);
    deps.setVoiceName("");
    return;
  }

  const index = parseInt(value, 10);
  const voices = deps.getVoices();
  if (voices[index]) {
    deps.setVoiceName(voices[index].name);
    stateStore.setItem(StorageKeys.TTS_VOICE_NAME, voices[index].name);
  }
}

export function setupTtsControls(refs, deps) {
  const {
    selectTtsProvider,
    sliderTtsRate,
    sliderTtsPitch,
    sliderTtsVolume,
    selectHomeTtsRate,
    selectHomeTtsPitch,
    selectHomeTtsVoice,
    selectTtsVoice,
    displayTtsRate,
    displayTtsPitch,
    displayTtsVolume
  } = refs;

  const savedTts = stateStore.getItem(StorageKeys.TTS_PROVIDER);
  if (savedTts && selectTtsProvider) {
    selectTtsProvider.value = savedTts;
    deps.updateHomeIndicators();
  }

  selectTtsProvider?.addEventListener("change", (e) => {
    stateStore.setItem(StorageKeys.TTS_PROVIDER, e.target.value);
    deps.updateHomeIndicators();
    deps.updateButtonsState("stopped");
  });

  if (typeof speechSynthesis !== "undefined") {
    deps.populateVoicesList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = deps.populateVoicesList;
    }
  }

  sliderTtsRate?.addEventListener("input", (e) => {
    const rate = parseFloat(e.target.value);
    deps.setRate(rate);
    if (displayTtsRate) displayTtsRate.textContent = `${rate.toFixed(1)}x`;
    stateStore.setItem(StorageKeys.TTS_RATE, rate.toString());
    syncClosestOption(selectHomeTtsRate, rate);

    const activeAudio = deps.getActiveAudio();
    if (activeAudio) activeAudio.playbackRate = rate;
  });

  selectHomeTtsRate?.addEventListener("change", (e) => {
    const rate = parseFloat(e.target.value);
    deps.setRate(rate);
    stateStore.setItem(StorageKeys.TTS_RATE, rate.toString());
    if (sliderTtsRate) sliderTtsRate.value = rate.toString();
    if (displayTtsRate) displayTtsRate.textContent = `${rate.toFixed(1)}x`;

    const activeAudio = deps.getActiveAudio();
    if (activeAudio) activeAudio.playbackRate = rate;
  });

  sliderTtsPitch?.addEventListener("input", (e) => {
    const pitch = parseFloat(e.target.value);
    deps.setPitch(pitch);
    if (displayTtsPitch) displayTtsPitch.textContent = `${pitch.toFixed(1)}x`;
    stateStore.setItem(StorageKeys.TTS_PITCH, pitch.toString());
    syncClosestOption(selectHomeTtsPitch, pitch);
  });

  selectHomeTtsPitch?.addEventListener("change", (e) => {
    const pitch = parseFloat(e.target.value);
    deps.setPitch(pitch);
    stateStore.setItem(StorageKeys.TTS_PITCH, pitch.toString());
    if (sliderTtsPitch) sliderTtsPitch.value = pitch.toString();
    if (displayTtsPitch) displayTtsPitch.textContent = `${pitch.toFixed(1)}x`;
  });

  sliderTtsVolume?.addEventListener("input", (e) => {
    const volPercent = parseInt(e.target.value, 10);
    const volume = volPercent / 100;
    deps.setVolume(volume);
    if (displayTtsVolume) displayTtsVolume.textContent = `${volPercent}%`;
    stateStore.setItem(StorageKeys.TTS_VOLUME, volume.toString());

    const activeAudio = deps.getActiveAudio();
    if (activeAudio) activeAudio.volume = volume;
  });

  selectHomeTtsVoice?.addEventListener("change", (e) => {
    persistVoiceSelection(e.target.value, refs, deps);
  });

  selectTtsVoice?.addEventListener("change", (e) => {
    persistVoiceSelection(e.target.value, refs, deps);
  });

  const savedRate = stateStore.getItem(StorageKeys.TTS_RATE);
  if (savedRate) {
    const rate = parseFloat(savedRate);
    deps.setRate(rate);
    if (sliderTtsRate) sliderTtsRate.value = rate.toString();
    if (displayTtsRate) displayTtsRate.textContent = `${rate.toFixed(1)}x`;
    syncClosestOption(selectHomeTtsRate, rate);
  }

  const savedPitch = stateStore.getItem(StorageKeys.TTS_PITCH);
  if (savedPitch) {
    const pitch = parseFloat(savedPitch);
    deps.setPitch(pitch);
    if (sliderTtsPitch) sliderTtsPitch.value = pitch.toString();
    if (displayTtsPitch) displayTtsPitch.textContent = `${pitch.toFixed(1)}x`;
    syncClosestOption(selectHomeTtsPitch, pitch);
  }

  const savedVolume = stateStore.getItem(StorageKeys.TTS_VOLUME);
  if (savedVolume) {
    const volume = parseFloat(savedVolume);
    deps.setVolume(volume);
    if (sliderTtsVolume) sliderTtsVolume.value = Math.round(volume * 100).toString();
    if (displayTtsVolume) displayTtsVolume.textContent = `${Math.round(volume * 100)}%`;
  }
}
