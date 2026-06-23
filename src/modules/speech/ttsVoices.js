import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

function fillVoiceSelect(select, voices, defaultLabel) {
  if (!select) return;
  select.innerHTML = "";
  const defOpt = document.createElement("option");
  defOpt.value = "default";
  defOpt.textContent = defaultLabel;
  select.appendChild(defOpt);

  voices.forEach((voice, index) => {
    const opt = document.createElement("option");
    opt.value = index.toString();
    opt.textContent = `${voice.name} (${voice.lang})`;
    select.appendChild(opt);
  });
}

export function populateVoiceSelects({ homeVoiceSelect, settingsVoiceSelect }) {
  if (typeof speechSynthesis === "undefined") {
    return { voices: [], selectedVoiceName: "" };
  }

  const voices = speechSynthesis.getVoices();
  fillVoiceSelect(homeVoiceSelect, voices, "الافتراضي");
  fillVoiceSelect(settingsVoiceSelect, voices, "صوت النظام الافتراضي");

  const savedVoiceName = stateStore.getItem(StorageKeys.TTS_VOICE_NAME);
  if (savedVoiceName) {
    const matchedVoiceIndex = voices.findIndex(voice => voice.name === savedVoiceName);
    if (matchedVoiceIndex !== -1) {
      if (homeVoiceSelect) homeVoiceSelect.value = matchedVoiceIndex.toString();
      if (settingsVoiceSelect) settingsVoiceSelect.value = matchedVoiceIndex.toString();
      return { voices, selectedVoiceName: savedVoiceName };
    }
  }

  return { voices, selectedVoiceName: "" };
}
