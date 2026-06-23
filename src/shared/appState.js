import { stateStore } from "./stateStore.js";
import { StorageKeys } from "./storageKeys.js";
import { isTauri } from "./tauriClient.js";

// Writable store constructor (identical to Svelte's writable)
export function writable(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  return {
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      subscribers.forEach(run => run(value));
    },
    update(updateFn) {
      this.set(updateFn(value));
    },
    subscribe(run) {
      subscribers.add(run);
      run(value);
      return () => {
        subscribers.delete(run);
      };
    },
    get() {
      return value;
    }
  };
}

const getInitialFreeSttEngine = () => {
  try {
    if (!isTauri && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      return stateStore.getItem(StorageKeys.FREE_STT_ENGINE, "google-webspeech");
    }
  } catch (e) {}
  return "none";
};

const loadSpeechLanguage = () => {
  const raw = stateStore.getJSON(StorageKeys.SPEECH_LANGUAGE, import.meta.env?.VITE_DEFAULT_SPEECH_LANGUAGE || "ar");
  if (typeof raw !== "string") return "ar";
  let current = raw.trim();
  for (let i = 0; i < 12; i++) {
    if (current.startsWith('"') && current.endsWith('"')) {
      try {
        const parsed = JSON.parse(current);
        if (typeof parsed === "string" && parsed !== current) {
          current = parsed.trim();
          continue;
        }
      } catch { break; }
    }
    break;
  }
  const base = current.split(/[-_]/)[0].toLowerCase();
  return /^[a-z]{2,3}$/.test(base) ? base : "ar";
};

// Define individual writable stores
const stores = {
  activeApiKey: writable(""),
  activeProvider: writable(""),
  speechModel: writable(stateStore.getJSON(StorageKeys.SPEECH_MODEL, import.meta.env?.VITE_DEFAULT_SPEECH_MODEL || "whisper-large-v3")),
  speechLanguage: writable(loadSpeechLanguage()),
  textModel: writable(stateStore.getJSON(StorageKeys.TEXT_MODEL, import.meta.env?.VITE_DEFAULT_TEXT_MODEL || "gemini-1.5-flash")),
  diacritizeProvider: writable(stateStore.getJSON(StorageKeys.DIACRITIZE_PROVIDER, "")),
  diacritizeModel: writable(stateStore.getJSON(StorageKeys.DIACRITIZE_MODEL, "")),
  appendMode: writable(stateStore.getJSON(StorageKeys.APPEND_MODE, false)),
  appendSeparator: writable(stateStore.getJSON("bm_append_separator", "newline")),
  textInsertionMode: writable(stateStore.getJSON("bm_text_insertion_mode", "replace")),
  autoGrammar: writable(false),
  autoDiacritize: writable(false),
  voiceTranslation: writable(false),
  liveTranscriptionEnabled: writable(stateStore.getJSON(StorageKeys.LIVE_TRANSCRIPTION, false)),
  selectionFloatingMenuEnabled: writable(stateStore.getJSON(StorageKeys.SELECTION_MENU_ENABLED, true)),
  textOutputTarget: writable(stateStore.getJSON(StorageKeys.TEXT_OUTPUT_TARGET, "both")),
  freeSttEngine: writable(getInitialFreeSttEngine()),
  sttShortcutBehavior: writable(stateStore.getJSON(StorageKeys.STT_SHORTCUT_BEHAVIOR, "toggle")),
  textShortcutBehavior: writable(stateStore.getJSON(StorageKeys.TEXT_SHORTCUT_BEHAVIOR, "single")),
  backgroundRecordingEnabled: writable(stateStore.getJSON("bm_background_recording_enabled", false)),
};

// Export appState container
export const appState = {
  // Backward-compatibility APIs
  get(key) {
    if (!stores[key]) throw new Error(`State key "${key}" does not exist`);
    return stores[key].get();
  },
  set(key, value) {
    if (!stores[key]) throw new Error(`State key "${key}" does not exist`);
    stores[key].set(value);
  },
  subscribe(key, fn) {
    if (!stores[key]) throw new Error(`State key "${key}" does not exist`);
    return stores[key].subscribe(fn);
  },
  
  // Directly expose individual writable stores for future Svelte/component bindings
  ...stores
};

// Auto-persistence subscriptions
appState.speechModel.subscribe((value) => stateStore.setJSON(StorageKeys.SPEECH_MODEL, value || ""));
appState.speechLanguage.subscribe((value) => stateStore.setJSON(StorageKeys.SPEECH_LANGUAGE, value || ""));
appState.textModel.subscribe((value) => stateStore.setJSON(StorageKeys.TEXT_MODEL, value || ""));
appState.diacritizeProvider.subscribe((value) => stateStore.setJSON(StorageKeys.DIACRITIZE_PROVIDER, value || ""));
appState.diacritizeModel.subscribe((value) => stateStore.setJSON(StorageKeys.DIACRITIZE_MODEL, value || ""));
appState.appendMode.subscribe((value) => stateStore.setJSON(StorageKeys.APPEND_MODE, !!value));
appState.appendSeparator.subscribe((value) => stateStore.setJSON("bm_append_separator", value || "newline"));
appState.textInsertionMode.subscribe((value) => stateStore.setJSON("bm_text_insertion_mode", value || "replace"));
appState.liveTranscriptionEnabled.subscribe((value) => stateStore.setJSON(StorageKeys.LIVE_TRANSCRIPTION, !!value));
appState.selectionFloatingMenuEnabled.subscribe((value) => stateStore.setJSON(StorageKeys.SELECTION_MENU_ENABLED, !!value));
appState.textOutputTarget.subscribe((value) => stateStore.setJSON(StorageKeys.TEXT_OUTPUT_TARGET, value || "both"));
appState.freeSttEngine.subscribe((value) => stateStore.setJSON(StorageKeys.FREE_STT_ENGINE, value || "none"));
appState.sttShortcutBehavior.subscribe((value) => stateStore.setJSON(StorageKeys.STT_SHORTCUT_BEHAVIOR, value || "toggle"));
appState.textShortcutBehavior.subscribe((value) => stateStore.setJSON(StorageKeys.TEXT_SHORTCUT_BEHAVIOR, value || "single"));
appState.backgroundRecordingEnabled.subscribe((value) => stateStore.setJSON("bm_background_recording_enabled", !!value));
