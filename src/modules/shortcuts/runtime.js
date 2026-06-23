import { appState } from "../../shared/appState.js";

export function setupRuntimeShortcutHandler(options) {
  let lastSttPressTime = 0;
  let sttLongPressTimeout = null;
  let sttLongPressTriggered = false;
  let lastTextPressTime = 0;
  let textLongPressTimeout = null;
  const activeShortcutPresses = new Set();

  options.listen("global-shortcut-triggered", async (event) => {
    try {
      const data = JSON.parse(event.payload);
      const action = data.action;
      const state = data.state;

      if (state === "pressed") {
        if (activeShortcutPresses.has(action)) return;
        activeShortcutPresses.add(action);
      } else if (state === "released") {
        activeShortcutPresses.delete(action);
      }

      if (action === "speech-to-text") {
        handleSpeechShortcut(state, options);
      } else if (action === "text-utilities") {
        handleTextShortcut(state, options);
      }
    } catch (err) {
      if (event.payload === "speech-to-text") {
        options.toggleRecording();
      } else if (event.payload === "text-utilities") {
        options.showTextTools();
      }
    }
  });

  function handleSpeechHold(state, deps) {
    if (state === "pressed") {
      deps.startStt(true);
    } else if (state === "released") {
      deps.stopStt();
    }
  }

  function handleSpeechLongPress(state, deps) {
    if (state === "pressed") {
      if (deps.isRecordingActive()) {
        deps.stopStt();
        if (sttLongPressTimeout) {
          clearTimeout(sttLongPressTimeout);
          sttLongPressTimeout = null;
        }
        sttLongPressTriggered = false;
      } else {
        sttLongPressTriggered = false;
        if (sttLongPressTimeout) clearTimeout(sttLongPressTimeout);
        sttLongPressTimeout = setTimeout(() => {
          sttLongPressTriggered = true;
          deps.startStt(true);
        }, 1200);
      }
    } else if (state === "released") {
      if (sttLongPressTimeout) {
        clearTimeout(sttLongPressTimeout);
        sttLongPressTimeout = null;
      }
      sttLongPressTriggered = false;
    }
  }

  function handleSpeechDouble(state, deps) {
    if (state === "pressed") {
      if (deps.isRecordingActive()) {
        deps.toggleRecording(true);
      } else {
        const now = Date.now();
        if (now - lastSttPressTime < 350) {
          deps.toggleRecording(true);
        }
        lastSttPressTime = now;
      }
    }
  }

  function handleSpeechShortcut(state, deps) {
    const freeEngine = appState.get("freeSttEngine") || "none";
    const hasApiKey = !!appState.get("activeApiKey");
    const provider = (freeEngine !== "none" && !hasApiKey) ? "WebSpeech" : (appState.get("activeProvider") || "Gemini");

    // المزودون السحابيون: الاختصار = تسجيل مباشر في Rust
    if (provider !== "WebSpeech") {
      return;
    }

    const behavior = deps.getSttBehavior();
    if (behavior === "disabled") return;

    if (behavior === "hold") {
      handleSpeechHold(state, deps);
      return;
    }

    if (behavior === "long_press_start") {
      handleSpeechLongPress(state, deps);
      return;
    }

    if (behavior === "double") {
      handleSpeechDouble(state, deps);
      return;
    }

    if (state === "pressed") {
      deps.toggleRecording(true);
    }
  }

  function handleTextShortcut(state, deps) {
    const behavior = deps.getTextBehavior();
    if (behavior === "disabled") return;

    if (behavior === "double") {
      if (state === "pressed") {
        const now = Date.now();
        if (now - lastTextPressTime < 350) {
          deps.showTextTools();
        }
        lastTextPressTime = now;
      }
      return;
    }

    if (behavior === "long_press") {
      if (state === "pressed") {
        if (textLongPressTimeout) clearTimeout(textLongPressTimeout);
        textLongPressTimeout = setTimeout(() => {
          textLongPressTimeout = null;
          deps.showTextTools();
        }, 700);
      } else if (state === "released") {
        if (textLongPressTimeout) {
          clearTimeout(textLongPressTimeout);
          textLongPressTimeout = null;
        }
      }
      return;
    }

    if (state === "pressed") {
      deps.showTextTools();
    }
  }
}
