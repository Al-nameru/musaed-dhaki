import { invoke, isTauri } from "../../shared/tauriClient.js";
import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";

export const DEFAULT_STT_SHORTCUT = { ctrl: true, shift: true, alt: false, key: "1" };
export const DEFAULT_TEXT_SHORTCUT = { ctrl: true, shift: true, alt: false, key: "2" };

let activeRecorderButton = null;
let clearHoldTimer = () => {};

export function normalizeSttShortcutBehavior(value) {
  const allowed = ["toggle", "hold", "double", "long_press_start", "disabled"];
  return allowed.includes(value) ? value : "toggle";
}

export function normalizeTextShortcutBehavior(value) {
  const allowed = ["single", "double", "long_press", "disabled"];
  return allowed.includes(value) ? value : "single";
}

function normalizeShortcut(shortcut, fallback) {
  const source = shortcut || fallback;
  return {
    ctrl: !!source.ctrl,
    shift: !!source.shift,
    alt: !!source.alt,
    key: source.key || fallback.key
  };
}

function getShortcutDisplayString(ctrl, shift, alt, key) {
  let parts = [];
  const k = key ? key.toUpperCase() : "";
  if (k === "CONTROL" || k === "CTRL") {
    return "Ctrl";
  }
  if (k === "SHIFT") {
    return "Shift";
  }
  if (k === "ALT") {
    return "Alt";
  }
  if (ctrl) parts.push("Ctrl");
  if (shift) parts.push("Shift");
  if (alt) parts.push("Alt");
  if (key) parts.push(key);
  return parts.join(" + ");
}

function getShortcutDisplayFromObject(shortcut, fallback) {
  const normalized = normalizeShortcut(shortcut, fallback);
  return getShortcutDisplayString(normalized.ctrl, normalized.shift, normalized.alt, normalized.key);
}

function isBareSpaceShortcut(shortcut) {
  return shortcut && shortcut.key === "SPACE" && !shortcut.ctrl && !shortcut.shift && !shortcut.alt;
}

export function isBareModifierShortcut(shortcut) {
  if (!shortcut) return false;
  const k = String(shortcut.key).toUpperCase();
  if (k === "CONTROL" || k === "CTRL") {
    return !shortcut.shift && !shortcut.alt;
  }
  if (k === "SHIFT") {
    return !shortcut.ctrl && !shortcut.alt;
  }
  if (k === "ALT") {
    return !shortcut.ctrl && !shortcut.shift;
  }
  return false;
}

export function getSttShortcut() {
  return loadStoredShortcut("bm_shortcut_stt", DEFAULT_STT_SHORTCUT);
}

export function getTextShortcut() {
  return loadStoredShortcut("bm_shortcut_text", DEFAULT_TEXT_SHORTCUT);
}


export function loadStoredShortcut(storageKey, fallback) {
  try {
    const saved = stateStore.getItem(storageKey);
    return saved ? normalizeShortcut(JSON.parse(saved), fallback) : fallback;
  } catch (e) {
    stateStore.setItem(storageKey, JSON.stringify(fallback));
    return fallback;
  }
}

export function updateShortcutDisplay(eventName, shortcut, behavior) {
  const isStt = eventName === "speech-to-text";
  const fallback = isStt ? DEFAULT_STT_SHORTCUT : DEFAULT_TEXT_SHORTCUT;
  const display = getShortcutDisplayFromObject(shortcut, fallback);
  const isDisabled = behavior === "disabled";
  const labelText = isDisabled ? `${display} (معطّل — لا يعمل كاختصار عام)` : display;

  const btnClass = isStt ? ".btn-record-stt-shortcut-class" : ".btn-record-text-shortcut-class";
  const lblClass = isStt ? ".lbl-active-stt-shortcut-class" : ".lbl-active-text-shortcut-class";

  document.querySelectorAll(btnClass).forEach(btn => {
    btn.textContent = display;
  });
  document.querySelectorAll(lblClass).forEach(lbl => {
    lbl.textContent = labelText;
  });
}

function setRecorderButtonState(eventName, text, isRecording) {
  const isStt = eventName === "speech-to-text";
  const btnClass = isStt ? ".btn-record-stt-shortcut-class" : ".btn-record-text-shortcut-class";
  document.querySelectorAll(btnClass).forEach(btn => {
    if (text) btn.textContent = text;
    if (isRecording) {
      btn.style.border = "1px solid var(--accent)";
      btn.style.background = "rgba(99, 102, 241, 0.15)";
    } else {
      btn.style.border = "1px dashed var(--border)";
      btn.style.background = "var(--surface-2)";
    }
  });
}

function migrateConflictingShortcutDefaults() {
  if (stateStore.getItem(StorageKeys.SHORTCUT_DEFAULTS) === "done") return;
  const oldStt = { ctrl: true, shift: true, alt: false, key: "V" };
  const oldText = { ctrl: true, shift: true, alt: false, key: "T" };
  const sameAs = (a, b) => !!a && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt &&
    String(a.key).toUpperCase() === String(b.key).toUpperCase();

  try {
    const stt = JSON.parse(stateStore.getItem(StorageKeys.SHORTCUT_STT) || "null");
    if (sameAs(stt, oldStt)) stateStore.setItem(StorageKeys.SHORTCUT_STT, JSON.stringify(DEFAULT_STT_SHORTCUT));
  } catch (e) {}

  try {
    const text = JSON.parse(stateStore.getItem(StorageKeys.SHORTCUT_TEXT) || "null");
    if (sameAs(text, oldText)) stateStore.setItem(StorageKeys.SHORTCUT_TEXT, JSON.stringify(DEFAULT_TEXT_SHORTCUT));
  } catch (e) {}

  stateStore.setItem(StorageKeys.SHORTCUT_DEFAULTS, "done");
}
function shortcutsEqual(a, b) {
  if (!a || !b) return false;
  return !!a.ctrl === !!b.ctrl
    && !!a.shift === !!b.shift
    && !!a.alt === !!b.alt
    && String(a.key).toUpperCase() === String(b.key).toUpperCase();
}

function findShortcutConflict(eventName, shortcut) {
  const otherStorageKey = eventName === "speech-to-text" ? "bm_shortcut_text" : "bm_shortcut_stt";
  const otherFallback = eventName === "speech-to-text" ? DEFAULT_TEXT_SHORTCUT : DEFAULT_STT_SHORTCUT;
  const other = loadStoredShortcut(otherStorageKey, otherFallback);
  if (shortcutsEqual(shortcut, other)) {
    return "هذا الاختصار مستخدم بالفعل للوظيفة الأخرى. اختر تركيبة مختلفة.";
  }
  return null;
}

async function registerShortcutOnBackend(eventName, ctrl, shift, alt, key) {
  if (!isTauri) {
    return true;
  }

  const conflict = findShortcutConflict(eventName, { ctrl, shift, alt, key });
  if (conflict) {
    alert(conflict);
    return false;
  }

  try {
    await invoke("register_custom_shortcut", {
      eventName,
      ctrl,
      shift,
      alt,
      key
    });
    return true;
  } catch (err) {
    const errorMsg = String(err);
    if (errorMsg.includes("already registered") || errorMsg.includes("already exists") || errorMsg.includes("HotKey already registered")) {
      alert("فشل تسجيل الاختصار: هذا الاختصار مستخدم بالفعل من قبل برنامج آخر في نظام التشغيل ( مثل Discord أو GeForce Experience أو نسخة أخرى من هذا التطبيق ). يرجى إغلاق البرنامج المتعارض أو اختيار اختصار آخر.");
    } else {
      alert("فشل تسجيل الاختصار: " + errorMsg);
    }
    return false;
  }
}

async function unregisterShortcutOnBackend(eventName) {
  if (!isTauri) return true;
  try {
    await invoke("unregister_custom_shortcut", { eventName });
    return true;
  } catch (err) {
    console.error("unregister_custom_shortcut failed:", err);
    return false;
  }
}

export async function applyShortcutState(eventName, shortcut, behavior) {
  if (behavior === "disabled") {
    return unregisterShortcutOnBackend(eventName);
  }
  return registerShortcutOnBackend(eventName, shortcut.ctrl, shortcut.shift, shortcut.alt, shortcut.key);
}

let initialShortcutsRegistered = false;

export async function loadAndRegisterShortcuts({ sttBehavior, textBehavior }) {
  if (initialShortcutsRegistered) return;
  initialShortcutsRegistered = true;

  migrateConflictingShortcutDefaults();

  const normalizedSttBehavior = normalizeSttShortcutBehavior(sttBehavior);
  const sttShortcut = loadStoredShortcut("bm_shortcut_stt", DEFAULT_STT_SHORTCUT);
  updateShortcutDisplay("speech-to-text", sttShortcut, normalizedSttBehavior);
  await applyShortcutState("speech-to-text", sttShortcut, normalizedSttBehavior);

  const normalizedTextBehavior = normalizeTextShortcutBehavior(textBehavior);
  const textShortcut = loadStoredShortcut("bm_shortcut_text", DEFAULT_TEXT_SHORTCUT);
  updateShortcutDisplay("text-utilities", textShortcut, normalizedTextBehavior);
  await applyShortcutState("text-utilities", textShortcut, normalizedTextBehavior);
}

export function shortcutBehaviorFor(eventName, { sttBehavior, textBehavior }) {
  return eventName === "speech-to-text"
    ? normalizeSttShortcutBehavior(sttBehavior)
    : normalizeTextShortcutBehavior(textBehavior);
}

export function refreshShortcutDisplays({ sttBehavior, textBehavior }) {
  updateShortcutDisplay(
    "speech-to-text",
    loadStoredShortcut("bm_shortcut_stt", DEFAULT_STT_SHORTCUT),
    shortcutBehaviorFor("speech-to-text", { sttBehavior, textBehavior })
  );
  updateShortcutDisplay(
    "text-utilities",
    loadStoredShortcut("bm_shortcut_text", DEFAULT_TEXT_SHORTCUT),
    shortcutBehaviorFor("text-utilities", { sttBehavior, textBehavior })
  );
}

export function isShortcutRecording() {
  return !!activeRecorderButton;
}

export function isBareSpaceAssignedAsShortcut() {
  const sttShortcut = loadStoredShortcut("bm_shortcut_stt", DEFAULT_STT_SHORTCUT);
  const textShortcut = loadStoredShortcut("bm_shortcut_text", DEFAULT_TEXT_SHORTCUT);
  return isBareSpaceShortcut(sttShortcut) || isBareSpaceShortcut(textShortcut);
}

const KEY_CODE_MAP = {
  "Space": "SPACE",
  "Enter": "ENTER",
  "NumpadEnter": "ENTER",
  "Tab": "TAB",
  "Escape": "ESCAPE",
  "Backspace": "BACKSPACE",
  "Delete": "DELETE",
  "Insert": "INSERT",
  "Pause": "PAUSE",
  "CapsLock": "CAPSLOCK",
  "PrintScreen": "PRINTSCREEN",
  "ScrollLock": "SCROLLLOCK",
  "ArrowUp": "ARROWUP",
  "ArrowDown": "ARROWDOWN",
  "ArrowLeft": "ARROWLEFT",
  "ArrowRight": "ARROWRIGHT",
  "Home": "HOME",
  "End": "END",
  "PageUp": "PAGEUP",
  "PageDown": "PAGEDOWN",
  "Backquote": "BACKQUOTE",
  "Minus": "MINUS",
  "Equal": "EQUAL",
  "BracketLeft": "BRACKETLEFT",
  "BracketRight": "BRACKETRIGHT",
  "Backslash": "BACKSLASH",
  "Semicolon": "SEMICOLON",
  "Quote": "QUOTE",
  "Comma": "COMMA",
  "Period": "PERIOD",
  "Slash": "SLASH",
  "NumpadAdd": "NUMPADADD",
  "NumpadSubtract": "NUMPADSUBTRACT",
  "NumpadMultiply": "NUMPADMULTIPLY",
  "NumpadDivide": "NUMPADDIVIDE",
  "NumpadDecimal": "NUMPADDECIMAL"
};

function translateJsKeyToRust(key, code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code.toUpperCase();

  if (code && KEY_CODE_MAP[code]) return KEY_CODE_MAP[code];
  if (key && KEY_CODE_MAP[key]) return KEY_CODE_MAP[key];

  if (key === " ") return "SPACE";
  if (key === "`") return "BACKQUOTE";
  if (key === "-") return "MINUS";
  if (key === "=") return "EQUAL";
  if (key === "[") return "BRACKETLEFT";
  if (key === "]") return "BRACKETRIGHT";
  if (key === "\\") return "BACKSLASH";
  if (key === ";") return "SEMICOLON";
  if (key === "'") return "QUOTE";
  if (key === ",") return "COMMA";
  if (key === ".") return "PERIOD";
  if (key === "/") return "SLASH";
  if (/^F[1-9]$|^F1[0-2]$/.test(key)) return key.toUpperCase();
  if (key && key.length === 1) {
    if (/[a-zA-Z]/.test(key)) return key.toUpperCase();
    if (/[0-9]/.test(key)) return key;
  }
  return null;
}

let recordingHadNonModifier = false;

function handleShortcutRecordKeyDown(event) {
  if (!activeRecorderButton) return;
  event.preventDefault();
  event.stopPropagation();

  const ctrl = event.ctrlKey;
  const shift = event.shiftKey;
  const alt = event.altKey;

  if (event.key === "Escape" && !ctrl && !shift && !alt) {
    stopShortcutRecording(false);
    return;
  }

  const eventName = activeRecorderButton.id === "btn-record-stt-shortcut" ? "speech-to-text" : "text-utilities";
  const isModifierOnly = ["Control", "Shift", "Alt", "Meta"].includes(event.key);
  let keyDisplay = "";
  if (ctrl) keyDisplay += "Ctrl + ";
  if (shift) keyDisplay += "Shift + ";
  if (alt) keyDisplay += "Alt + ";

  if (!isModifierOnly) {
    recordingHadNonModifier = true;
    const rustKey = translateJsKeyToRust(event.key, event.code);
    if (rustKey) {
      keyDisplay += rustKey;
      const shortcut = { ctrl, shift, alt, key: rustKey };
      setRecorderButtonState(eventName, keyDisplay, true);
      stopShortcutRecording(true, shortcut);
    } else {
      setRecorderButtonState(eventName, "⏳ مفتاح غير مدعوم — جرّب حرفاً أو رقماً أو F1…", true);
      setTimeout(() => {
        if (activeRecorderButton) {
          setRecorderButtonState(eventName, "⏳ اضغط المفاتيح الآن...", true);
        }
      }, 1200);
    }
  } else {
    setRecorderButtonState(eventName, keyDisplay + "...", true);
  }
}

function handleShortcutRecordKeyUp(event) {
  if (!activeRecorderButton) return;
  event.preventDefault();
  event.stopPropagation();

  const eventName = activeRecorderButton.id === "btn-record-stt-shortcut" ? "speech-to-text" : "text-utilities";
  const isModifierOnly = ["Control", "Shift", "Alt", "Meta"].includes(event.key);
  if (isModifierOnly && !recordingHadNonModifier) {
    let shortcut = null;
    if (event.key === "Control") {
      shortcut = { ctrl: true, shift: false, alt: false, key: "CONTROL" };
    } else if (event.key === "Shift") {
      shortcut = { ctrl: false, shift: true, alt: false, key: "SHIFT" };
    } else if (event.key === "Alt") {
      shortcut = { ctrl: false, shift: false, alt: true, key: "ALT" };
    }

    if (shortcut) {
      const displayStr = getShortcutDisplayString(shortcut.ctrl, shortcut.shift, shortcut.alt, shortcut.key);
      setRecorderButtonState(eventName, displayStr, true);
      stopShortcutRecording(true, shortcut);
    }
  }
}

function startShortcutRecording(button) {
  if (activeRecorderButton) {
    stopShortcutRecording(false);
  }

  clearHoldTimer();
  recordingHadNonModifier = false;
  button.blur();
  activeRecorderButton = button;
  const eventName = button.id === "btn-record-stt-shortcut" ? "speech-to-text" : "text-utilities";
  setRecorderButtonState(eventName, "⏳ اضغط المفاتيح الآن...", true);

  window.addEventListener("keydown", handleShortcutRecordKeyDown);
  window.addEventListener("keyup", handleShortcutRecordKeyUp);
}

async function stopShortcutRecording(save, shortcut = null) {
  if (!activeRecorderButton) return;

  window.removeEventListener("keydown", handleShortcutRecordKeyDown);
  window.removeEventListener("keyup", handleShortcutRecordKeyUp);

  const button = activeRecorderButton;
  activeRecorderButton = null;
  button.blur();

  const eventName = button.id === "btn-record-stt-shortcut" ? "speech-to-text" : "text-utilities";
  const storageKey = eventName === "speech-to-text" ? "bm_shortcut_stt" : "bm_shortcut_text";
  const fallbackShortcut = eventName === "speech-to-text" ? DEFAULT_STT_SHORTCUT : DEFAULT_TEXT_SHORTCUT;

  setRecorderButtonState(eventName, "", false);

  if (save && shortcut) {
    const { ctrl, shift, alt, key } = shortcut;

    // If it's a bare modifier, skip confirmSingleKey because we intend it as local hold
    const isBareMod = ["CONTROL", "SHIFT", "ALT"].includes(String(key).toUpperCase());
    if (!ctrl && !shift && !alt && !isBareMod) {
      const confirmSingleKey = confirm("لقد اخترت تعيين مفتاح واحد فقط بدون مفاتيح تعديل (Ctrl, Shift, Alt). يرجى الحذر، فقد يمنع هذا المفتاح من العمل بشكل طبيعي عند الكتابة في البرامج الأخرى. هل تريد الاستمرار وحفظ هذا الاختصار؟");
      if (!confirmSingleKey) {
        const currentSaved = loadStoredShortcut(storageKey, fallbackShortcut);
        const behavior = currentBehaviorFor(eventName);
        updateShortcutDisplay(eventName, currentSaved, behavior);
        return;
      }
    }

    const behavior = currentBehaviorFor(eventName);
    const ok = await applyShortcutState(eventName, shortcut, behavior);
    if (ok) {
      stateStore.setItem(storageKey, JSON.stringify(shortcut));
      updateShortcutDisplay(eventName, shortcut, behavior);
      if (isTauri) {
        window.dispatchEvent(new CustomEvent("shortcut-config-changed", {
          detail: { eventName, shortcut, behavior }
        }));
      }
    } else {
      const currentSaved = loadStoredShortcut(storageKey, fallbackShortcut);
      updateShortcutDisplay(eventName, currentSaved, behavior);
    }
  } else {
    const currentSaved = loadStoredShortcut(storageKey, fallbackShortcut);
    const behavior = currentBehaviorFor(eventName);
    updateShortcutDisplay(eventName, currentSaved, behavior);
  }
}

let currentBehaviorFor = () => "disabled";

async function resetShortcut(eventName) {
  const isStt = eventName === "speech-to-text";
  const storageKey = isStt ? "bm_shortcut_stt" : "bm_shortcut_text";
  const shortcut = isStt ? DEFAULT_STT_SHORTCUT : DEFAULT_TEXT_SHORTCUT;

  if (activeRecorderButton) {
    stopShortcutRecording(false);
  }

  const behavior = currentBehaviorFor(eventName);
  const ok = await applyShortcutState(eventName, shortcut, behavior);
  if (!ok) return;

  stateStore.setItem(storageKey, JSON.stringify(shortcut));
  updateShortcutDisplay(eventName, shortcut, behavior);
}

export function setupShortcutEditor({ getBehaviorFor, onStartRecording } = {}) {
  currentBehaviorFor = getBehaviorFor || currentBehaviorFor;
  clearHoldTimer = onStartRecording || clearHoldTimer;

  const btnRecordSttShortcut = document.getElementById("btn-record-stt-shortcut");
  const btnRecordTextShortcut = document.getElementById("btn-record-text-shortcut");
  const btnResetSttShortcut = document.getElementById("btn-reset-stt-shortcut");
  const btnResetTextShortcut = document.getElementById("btn-reset-text-shortcut");

  btnRecordSttShortcut?.addEventListener("click", () => {
    startShortcutRecording(btnRecordSttShortcut);
  });

  btnRecordTextShortcut?.addEventListener("click", () => {
    startShortcutRecording(btnRecordTextShortcut);
  });

  btnResetSttShortcut?.addEventListener("click", () => {
    resetShortcut("speech-to-text");
  });

  btnResetTextShortcut?.addEventListener("click", () => {
    resetShortcut("text-utilities");
  });
}
