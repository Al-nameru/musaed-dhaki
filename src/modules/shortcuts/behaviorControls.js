import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";
import {
  DEFAULT_STT_SHORTCUT,
  DEFAULT_TEXT_SHORTCUT,
  applyShortcutState,
  loadStoredShortcut,
  normalizeSttShortcutBehavior,
  normalizeTextShortcutBehavior,
  updateShortcutDisplay
} from "./editor.js";

async function applyBehaviorChange({
  eventName,
  storageKey,
  shortcut,
  behavior
}) {
  stateStore.setItem(storageKey, behavior);
  shortcut.select.value = behavior;
  const savedShortcut = loadStoredShortcut(shortcut.storageKey, shortcut.fallback);
  await applyShortcutState(eventName, savedShortcut, behavior);
  updateShortcutDisplay(eventName, savedShortcut, behavior);
}

export function setupShortcutBehaviorControls(refs, deps) {
  const { selectSttShortcutBehavior, selectTextShortcutBehavior } = refs;

  if (selectSttShortcutBehavior) {
    let sttBehavior = normalizeSttShortcutBehavior(deps.getSttShortcutBehavior());
    deps.setSttShortcutBehavior(sttBehavior);
    stateStore.setItem(StorageKeys.STT_SHORTCUT_BEHAVIOR, sttBehavior);
    selectSttShortcutBehavior.value = sttBehavior;
    selectSttShortcutBehavior.addEventListener("change", async (event) => {
      sttBehavior = normalizeSttShortcutBehavior(event.target.value);
      deps.setSttShortcutBehavior(sttBehavior);
      await applyBehaviorChange({
        eventName: "speech-to-text",
        storageKey: StorageKeys.STT_SHORTCUT_BEHAVIOR,
        behavior: sttBehavior,
        shortcut: {
          select: event.target,
          storageKey: "bm_shortcut_stt",
          fallback: DEFAULT_STT_SHORTCUT
        }
      });
    });
  }

  if (selectTextShortcutBehavior) {
    let textBehavior = normalizeTextShortcutBehavior(deps.getTextShortcutBehavior());
    deps.setTextShortcutBehavior(textBehavior);
    stateStore.setItem(StorageKeys.TEXT_SHORTCUT_BEHAVIOR, textBehavior);
    selectTextShortcutBehavior.value = textBehavior;
    selectTextShortcutBehavior.addEventListener("change", async (event) => {
      textBehavior = normalizeTextShortcutBehavior(event.target.value);
      deps.setTextShortcutBehavior(textBehavior);
      await applyBehaviorChange({
        eventName: "text-utilities",
        storageKey: StorageKeys.TEXT_SHORTCUT_BEHAVIOR,
        behavior: textBehavior,
        shortcut: {
          select: event.target,
          storageKey: "bm_shortcut_text",
          fallback: DEFAULT_TEXT_SHORTCUT
        }
      });
    });
  }
}
