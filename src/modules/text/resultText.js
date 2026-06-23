import { appState } from "../../shared/appState.js";

export function normalizeEditableResultElement(resultElement, getText, setText) {
  if (!resultElement || "value" in resultElement) return;

  Object.defineProperty(resultElement, "value", {
    configurable: true,
    get() {
      return getText();
    },
    set(value) {
      setText(value || "");
    }
  });
}

export function readResultText(resultElement) {
  if (!resultElement) return "";
  if (resultElement.matches?.("textarea, input")) return resultElement.value || "";
  return resultElement.innerText || resultElement.textContent || "";
}

export function writeResultText(resultElement, value) {
  if (!resultElement) return;
  const text = value || "";
  if (resultElement.matches?.("textarea, input")) {
    resultElement.value = text;
  } else {
    resultElement.textContent = text;
  }
}

export function resolveAppendMode(currentAppendMode) {
  try {
    const mode = appState.get("textInsertionMode");
    return mode === "append-newline" || mode === "append-space";
  } catch (e) {
    return currentAppendMode;
  }
}

export function insertTextAtCursor(element, text) {
  if (!element) return;
  
  if (element.matches?.("textarea, input")) {
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const val = element.value || "";
    element.value = val.substring(0, start) + text + val.substring(end);
    element.selectionStart = element.selectionEnd = start + text.length;
    element.focus();
    return;
  }

  element.focus();
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (element.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  }
  
  const existingText = readResultText(element);
  const separator = existingText ? " " : "";
  writeResultText(element, existingText + separator + text);
}

export function applyResultTextValue(resultElement, text, deps) {
  if (!resultElement) return;

  const cleanText = text || "";
  deps.setSuppressInput(true);

  const mode = deps.getTextInsertionMode ? deps.getTextInsertionMode() : "replace";
  const existingText = readResultText(resultElement);

  if (mode === "replace") {
    writeResultText(resultElement, cleanText);
  } else if (mode === "insert-cursor") {
    insertTextAtCursor(resultElement, cleanText);
  } else if (mode === "append-newline") {
    if (existingText.trim()) {
      writeResultText(resultElement, `${existingText.trim()}\n${cleanText}`);
    } else {
      writeResultText(resultElement, cleanText);
    }
  } else if (mode === "append-space") {
    if (existingText.trim()) {
      writeResultText(resultElement, `${existingText.trim()} ${cleanText}`);
    } else {
      writeResultText(resultElement, cleanText);
    }
  } else {
    writeResultText(resultElement, cleanText);
  }

  deps.setSuppressInput(false);
  deps.setLastAutoDiacritizeSource(cleanText.trim());
}
