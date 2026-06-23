import { invoke, isTauri } from "../../shared/tauriClient.js";

const LANGUAGE_MAP = {
  ar: "ar-EG",
  en: "en-US",
  auto: "ar-EG"
};

export async function toggleFreeSpeechRecognitionFlow(deps) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("عذراً، متصفحك أو نظام التشغيل الحالي لا يدعم Web Speech API للتعرف على الصوت مجاناً.");
    return;
  }

  if (deps.isRecordingActive()) {
    deps.setManualStopRequested(true);
    deps.setWebSpeechShouldListen(false);
    deps.setRecordingState("stopping");
    deps.setIgnoreRecordingToggleUntil(Date.now() + 900);
    deps.setIsRecording(false);
    deps.setRecordButtonRecording(false);
    deps.setStatus("⏳ جاري إيقاف الاستماع ومعالجة النص...");
    const recognitionInstance = deps.getRecognitionInstance();
    if (recognitionInstance) {
      recognitionInstance.stop();
    }
    return;
  }

  if (deps.getRecordingState() !== "idle") return;

  deps.setRecordingState("starting");
  deps.setStatus("⏳ جاري تهيئة الميكروفون...");
  deps.setManualStopRequested(false);
  deps.setWebSpeechShouldListen(true);
  deps.setRecordButtonRecording(true);
  await deps.captureExternalTarget();

  if (isTauri) {
    try {
      if (!document.hasFocus()) {
        await invoke("focus_main_window");
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else if (deps.isShortcut) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (e) {
      console.error("Failed to focus main window:", e);
    }
  }

  const shouldWriteWebSpeechToApp = deps.getTextOutputTarget() === "app" || deps.getTextOutputTarget() === "both";
  const currentAppText = deps.getResultText().trim();
  
  if (deps.setWebSpeechOriginalText) {
    deps.setWebSpeechOriginalText(currentAppText);
  }

  const insertionMode = deps.getTextInsertionMode ? deps.getTextInsertionMode() : "replace";
  const isAppend = insertionMode === "append-space" || insertionMode === "append-newline";
  const separator = insertionMode === "append-space" ? " " : "\n";

  deps.setWebSpeechBase((shouldWriteWebSpeechToApp && isAppend && currentAppText)
    ? currentAppText + separator
    : "");
  deps.setWebSpeechFinal("");
  if (shouldWriteWebSpeechToApp && insertionMode === "replace") {
    deps.setResultText("");
    deps.setLastAutoDiacritizeSource("");
  }

  const buildRecognizer = () => {
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = deps.getLiveTranscriptionEnabled();
    rec.lang = LANGUAGE_MAP[deps.getSpeechLanguage()] || "ar-EG";

    rec.onstart = () => {
      if (!deps.getWebSpeechShouldListen()) {
        rec.stop();
        return;
      }
      deps.setIsRecording(true);
      deps.setRecordingState("recording");
      deps.setStatus("🎙️ جاري الاستماع صوتياً (محرك جوجل المجاني)...");
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          deps.appendWebSpeechFinal(res[0].transcript);
        } else {
          interim += res[0].transcript;
        }
      }

      const textToShow = deps.getLiveTranscriptionEnabled()
        ? (deps.getWebSpeechFinal() + interim)
        : deps.getWebSpeechFinal();

      const mode = deps.getTextInsertionMode ? deps.getTextInsertionMode() : "replace";
      if (mode === "insert-cursor") {
        deps.setStatus(`🎙️ جاري الاستماع: ${textToShow}`);
        return;
      }

      deps.setSuppressResultTextInput(true);
      deps.setResultText(deps.getWebSpeechBase() + textToShow);
      deps.setSuppressResultTextInput(false);
    };

    rec.onerror = (event) => {
      const fatal = ["not-allowed", "service-not-allowed", "audio-capture"];
      if (fatal.includes(event.error)) {
        console.error("[Google Web Speech Error] error event:", event.error);
        deps.setWebSpeechShouldListen(false);
        deps.setStatus("❌ خطأ في التعرف: " + event.error);
        deps.addAppAlert("error", "خطأ في التعرف على الصوت", event.error, {
          source: "Google Web Speech"
        });
      }
    };

    rec.onend = () => {
      if (deps.getWebSpeechShouldListen()) {
        try {
          rec.start();
          return;
        } catch (_err) {
          setTimeout(() => {
            if (deps.getWebSpeechShouldListen()) {
              try { rec.start(); } catch (_e) { deps.finalizeWebSpeechSession(); }
            } else {
              deps.finalizeWebSpeechSession();
            }
          }, 250);
          return;
        }
      }
      deps.finalizeWebSpeechSession();
    };

    return rec;
  };

  const recognitionInstance = buildRecognizer();
  deps.setRecognitionInstance(recognitionInstance);
  deps.setStatus("🎙️ جاري الاستماع صوتياً (محرك جوجل المجاني)...");
  deps.addAppAlert("info", "بدأ الاستماع عبر Google Web Speech", "استماع متواصل حتى تضغط للإيقاف.", {
    source: "Google Web Speech"
  });
  deps.playBeepSound();
  recognitionInstance.start();
}
