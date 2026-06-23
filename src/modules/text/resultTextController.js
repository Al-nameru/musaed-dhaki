import {
  applyResultTextValue,
  normalizeEditableResultElement,
  readResultText,
  resolveAppendMode,
  writeResultText
} from "./resultText.js";

export function createResultTextController(deps) {
  const getElement = () => deps.getResultTextElement();

  const getText = () => readResultText(getElement());

  const setText = (value) => {
    writeResultText(getElement(), value);
  };

  const isAppendModeEnabled = () => {
    const appendMode = resolveAppendMode(deps.getAppendMode());
    deps.setAppendMode(appendMode);
    return appendMode;
  };

  return {
    getResultTextElement: getElement,
    normalizeEditableElement: () => normalizeEditableResultElement(getElement(), getText, setText),
    getText,
    setText,
    isAppendModeEnabled,
    applyText: (text) => applyResultTextValue(getElement(), text, {
      isAppendModeEnabled,
      getAppendSeparator: deps.getAppendSeparator,
      getTextInsertionMode: deps.getTextInsertionMode,
      setSuppressInput: deps.setSuppressResultTextInput,
      setLastAutoDiacritizeSource: deps.setLastAutoDiacritizeSource
    })
  };
}
