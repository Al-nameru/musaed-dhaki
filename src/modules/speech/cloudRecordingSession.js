import { invoke, isTauri } from "../../shared/tauriClient.js";
import { appState } from "../../shared/appState.js";

function applyDirectDictationUi(deps, phase) {
  if (phase === "recording") {
    deps.setIsRecording(true);
    deps.setRecordingState("recording");
    deps.setRecordButtonRecording(true);
    deps.setStatus("🎙️ جاري التسجيل بالخلفية...");
    return;
  }
  if (phase === "processing") {
    deps.setIsRecording(false);
    deps.setRecordingState("idle");
    deps.setRecordButtonRecording(false);
    deps.setStatus("⏳ جاري تفريغ الصوت وتحليله...");
    return;
  }
  deps.setIsRecording(false);
  deps.setRecordingState("idle");
  deps.setRecordButtonRecording(false);
  deps.setStatus("جاهز للبدء");
}

export function createCloudRecordingSession(deps) {
  let mediaRecorder = null;
  let activeAudioStream = null;
  let audioChunks = [];
  let currentRecordingSessionId = 0;
  const processedRecordingSessions = new Set();

  const stopActiveAudioStream = () => {
    if (activeAudioStream) {
      activeAudioStream.getTracks().forEach((track) => track.stop());
      activeAudioStream = null;
    }
  };

  const startRecording = async (isShortcut = false) => {
    if (deps.getRecordingState() !== "idle") return;

    const wantsDirect = appState.get("backgroundRecordingEnabled")
      && deps.isTauri
      && deps.getActiveProvider() !== "WebSpeech";

    if (wantsDirect) {
      if (!deps.getActiveApiKey()) {
        alert("يرجى إدخال مفتاح الـ API وتفعيله أولاً في صفحة المفاتيح.");
        return;
      }
      try {
        const active = await invoke("direct_dictation_is_active");
        await invoke("direct_dictation_toggle");
        applyDirectDictationUi(deps, active ? "processing" : "recording");
      } catch (err) {
        console.error("Direct dictation toggle failed:", err);
        applyDirectDictationUi(deps, "idle");
      }
      return;
    }

    if (deps.isTauri && deps.getActiveProvider() !== "WebSpeech" && !deps.getActiveApiKey()) {
      alert("يرجى إدخال مفتاح الـ API وتفعيله أولاً في صفحة المفاتيح.");
      return;
    }

    try {
      deps.setRecordingState("starting");
      deps.setStatus("⏳ جاري تهيئة الميكروفون...");
      deps.setManualStopRequested(false);
      deps.setRecordButtonRecording(true);
      await deps.captureExternalTarget();

      if (isTauri) {
        try {
          if (!document.hasFocus()) {
            await invoke("focus_main_window");
            await new Promise((resolve) => setTimeout(resolve, 350));
          } else if (isShortcut) {
            await new Promise((resolve) => setTimeout(resolve, 350));
          }
        } catch (e) {
          console.error("Failed to focus main window:", e);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (deps.getManualStopRequested() || deps.getRecordingState() === "stopping") {
        stream.getTracks().forEach((track) => track.stop());
        deps.setRecordingState("idle");
        deps.setRecordButtonRecording(false);
        return;
      }

      activeAudioStream = stream;
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const recordingSessionId = ++currentRecordingSessionId;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (processedRecordingSessions.has(recordingSessionId)) return;
        processedRecordingSessions.add(recordingSessionId);
        if (processedRecordingSessions.size > 20) {
          processedRecordingSessions.delete(Math.min(...processedRecordingSessions));
        }

        deps.playStopBeepSound();
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        stopActiveAudioStream();
        mediaRecorder = null;

        // [FIX] أعِد الحالة إلى idle فوراً حتى لا تُعيق آليةُ الانتظار زرَّ التسجيل والنصَّ الحي
        // processAudioTranscription تعمل بشكل صحيح async داخلياً وتُدير كل شيء بنفسها
        deps.setRecordingState("idle");
        deps.setManualStopRequested(false);
        deps.processAudioTranscription(audioBlob); // fire-and-forget — لا await هنا
      };

      mediaRecorder.start();
      deps.setIsRecording(true);
      deps.setRecordingState("recording");
      if (!deps.isAppendModeEnabled()) {
        deps.setResultText("");
        deps.setLastAutoDiacritizeSource("");
      }
      deps.setStatus("🎙️ جاري التسجيل... انقر للإيقاف");
      
      if (appState.get("backgroundRecordingEnabled")) {
        invoke("show_hud_notification", {
          icon: "🎙️",
          text: "🎙️ جاري تسجيل الصوت بالخلفية... اضغط للإيقاف"
        }).catch(() => {});
      } else {
        deps.addAppAlert("info", "بدأ تسجيل الصوت", "تم فتح الميكروفون وبدء التقاط الصوت.", {
          source: "التسجيل"
        });
      }
      deps.playBeepSound();
    } catch (err) {
      stopActiveAudioStream();
      deps.setIsRecording(false);
      deps.setRecordingState("idle");
      try { deps.setRecordButtonRecording(false); } catch (e) {}

      const isPermissionDenied = err && (err.name === "NotAllowedError" || /permission|denied/i.test(err.message || ""));
      if (isPermissionDenied) {
        deps.setStatus("❌ إذن الميكروفون مرفوض — افتح إعدادات المتصفح وسمح بالميكروفون ثم أعد المحاولة.");
        if (appState.get("backgroundRecordingEnabled")) {
          invoke("show_hud_notification", {
            icon: "❌",
            text: "إذن الميكروفون مرفوض"
          }).catch(() => {});
        } else {
          deps.addAppAlert("error", "إذن الميكروفون مرفوض", err, {
            source: "التسجيل"
          });
          try {
            alert("لم يتم منح إذن الميكروفون. افتح إعدادات الموقع في المتصفح وسمح بالوصول إلى الميكروفون ثم حاول مرة أخرى.");
          } catch (e) {}
        }
        deps.setIgnoreRecordingToggleUntil(Date.now() + 1500);
      } else {
        deps.setStatus("❌ فشل الوصول للميكروفون");
        if (appState.get("backgroundRecordingEnabled")) {
          invoke("show_hud_notification", {
            icon: "❌",
            text: "فشل الوصول للميكروفون"
          }).catch(() => {});
        } else {
          deps.addAppAlert("error", "فشل الوصول للميكروفون", err, {
            source: "التسجيل"
          });
        }
      }

      console.error(err);
    }
  };

  const stopRecording = () => {
    const wantsDirect = appState.get("backgroundRecordingEnabled")
      && deps.isTauri
      && deps.getActiveProvider() !== "WebSpeech";

    if (wantsDirect) {
      invoke("direct_dictation_is_active")
        .then((active) => invoke("direct_dictation_toggle").then(() => active))
        .then((wasActive) => {
          applyDirectDictationUi(deps, wasActive ? "processing" : "recording");
        })
        .catch((err) => {
          console.error("Direct dictation stop failed:", err);
          applyDirectDictationUi(deps, "idle");
        });
      return;
    }

    const recordingState = deps.getRecordingState();
    if (!deps.getIsRecording() && recordingState !== "starting" && recordingState !== "recording") {
      return;
    }

    deps.setManualStopRequested(true);
    deps.setRecordingState("stopping");
    deps.setIgnoreRecordingToggleUntil(Date.now() + 900);
    deps.setIsRecording(false);
    deps.setRecordButtonRecording(false);
    deps.setStatus("⏳ جاري إيقاف التسجيل وتحويل الصوت لنص...");

    if (appState.get("backgroundRecordingEnabled")) {
      invoke("show_hud_notification", {
        icon: "⏳",
        text: "جاري تفريغ الصوت وتحليله..."
      }).catch(() => {});
    }

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      stopActiveAudioStream();
    } else {
      stopActiveAudioStream();
      mediaRecorder = null;
      deps.setRecordingState("idle");
      deps.setStatus("جاهز للبدء");
    }
  };

  return {
    startRecording,
    stopRecording,
    stopActiveAudioStream
  };
}
