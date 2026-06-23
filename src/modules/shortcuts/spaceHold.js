const SPACE_HOLD_DELAY_MS = 650;

function isTextEditingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "textarea" ||
    tagName === "select" ||
    (tagName === "input" && !["button", "checkbox", "radio", "range"].includes(target.type))
  );
}

function removeTrailingSpace(target) {
  try {
    if (!target) return;
    if (target.matches?.("textarea, input")) {
      const start = target.selectionStart;
      const val = target.value;
      if (start > 0 && val[start - 1] === " ") {
        target.value = val.substring(0, start - 1) + val.substring(start);
        target.selectionStart = target.selectionEnd = start - 1;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else if (target.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const offset = range.startOffset;
          const text = textNode.textContent;
          if (offset > 0 && text[offset - 1] === " ") {
            textNode.textContent = text.substring(0, offset - 1) + text.substring(offset);
            range.setStart(textNode, offset - 1);
            range.setEnd(textNode, offset - 1);
            selection.removeAllRanges();
            selection.addRange(range);
            target.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to remove trailing space:", e);
  }
}

function eventMatchesShortcut(event, shortcut) {
  if (!shortcut) return false;
  const k = String(shortcut.key).toUpperCase();
  
  if (k === "SPACE") {
    return event.code === "Space" || event.key === " ";
  }
  if (k === "CONTROL" || k === "CTRL") {
    return event.key === "Control";
  }
  if (k === "SHIFT") {
    return event.key === "Shift";
  }
  if (k === "ALT") {
    return event.key === "Alt";
  }
  return false;
}

export function setupSpaceHoldShortcut(deps) {
  let spaceHoldTimer = null;
  let spaceHoldTriggered = false;
  let activeEventTarget = null;
  let lastPressTime = 0;

  const clearSpaceHoldTimer = () => {
    if (spaceHoldTimer) {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = null;
    }
  };

  window.addEventListener("keydown", (event) => {
    if (deps.isShortcutRecording()) return;

    const shortcut = deps.getSttShortcut?.() || null;
    if (!shortcut) return;

    const isSttTarget = eventMatchesShortcut(event, shortcut);

    // If a hold is active/pending and we see a keydown that is NOT our shortcut key, cancel the hold!
    if (spaceHoldTimer || spaceHoldTriggered) {
      if (!isSttTarget) {
        clearSpaceHoldTimer();
        spaceHoldTriggered = false;
        return;
      }
    }

    if (!isSttTarget) return;

    // Check if other modifiers are pressed. For a bare shortcut, other modifiers must not be pressed.
    const k = String(shortcut.key).toUpperCase();
    if (k === "CONTROL" || k === "CTRL") {
      if (event.shiftKey || event.altKey) return;
    } else if (k === "SHIFT") {
      if (event.ctrlKey || event.altKey) return;
    } else if (k === "ALT") {
      if (event.ctrlKey || event.shiftKey) return;
    } else if (k === "SPACE") {
      if (event.ctrlKey || event.shiftKey || event.altKey) return;
    }

    if (event.repeat) {
      // Prevent further spaces/modifiers from causing repeated behaviors while holding
      if (spaceHoldTimer || spaceHoldTriggered) {
        event.preventDefault();
      }
      return;
    }

    // Determine if we should allow hold.
    const isEditing = isTextEditingTarget(event.target);
    const behavior = deps.getSttShortcutBehavior?.() || "toggle";
    const recordingActive = deps.isRecordingActive?.() || false;

    activeEventTarget = event.target;

    // 1. If recording is active, a press should stop it (except for hold release, which stops on keyup)
    if (recordingActive) {
      if (behavior === "double" || behavior === "long_press_start" || behavior === "toggle") {
        event.preventDefault();
        deps.toggleRecording(); // Stop recording
        return;
      }
      return;
    }

    // 2. If recording is NOT active, handle the start trigger
    if (behavior === "toggle") {
      if (k === "SPACE" && !isEditing) {
        event.preventDefault();
      }
      deps.toggleRecording();
    } else if (behavior === "double") {
      const now = Date.now();
      if (k === "SPACE" && !isEditing) {
        event.preventDefault();
      }
      if (now - lastPressTime < 350) {
        if (k === "SPACE" && isEditing) {
          removeTrailingSpace(activeEventTarget);
        }
        deps.toggleRecording();
      }
      lastPressTime = now;
    } else if (behavior === "hold" || behavior === "long_press_start") {
      if (k === "SPACE" && !isEditing) {
        event.preventDefault();
      }

      spaceHoldTriggered = false;
      clearSpaceHoldTimer();

      spaceHoldTimer = setTimeout(() => {
        spaceHoldTimer = null;
        spaceHoldTriggered = true;
        
        // If we are in a text editor, clean up the initial typed space
        if (k === "SPACE" && isEditing) {
          removeTrailingSpace(activeEventTarget);
        }
        
        // Trigger recording based on behavior
        if (behavior === "hold") {
          deps.startStt();
        } else {
          deps.toggleRecording();
        }
      }, SPACE_HOLD_DELAY_MS);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (deps.isShortcutRecording()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const shortcut = deps.getSttShortcut?.() || null;
    if (!eventMatchesShortcut(event, shortcut)) return;

    clearSpaceHoldTimer();

    if (spaceHoldTriggered) {
      event.preventDefault();
      spaceHoldTriggered = false;

      const behavior = deps.getSttShortcutBehavior?.() || "toggle";
      if (behavior === "hold") {
        deps.stopStt();
      }
    }
    activeEventTarget = null;
  });

  return clearSpaceHoldTimer;
}

