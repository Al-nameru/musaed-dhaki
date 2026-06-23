import { appState } from "../../shared/appState.js";

let currentTranscriptionId = 0;
let networkListenerRegistered = false;
const transcriptionQueue = [];

function registerNetworkListener(deps) {
  window.addEventListener("online", async () => {
    if (transcriptionQueue.length > 0) {
      deps.setStatus("🔄 تم استعادة الاتصال بالإنترنت، جاري رفع الطلبات المتراكمة...");
      deps.addAppAlert("info", "تم كشف الاتصال بالإنترنت", "جاري إعادة معالجة التسجيلات الصوتية المتراكمة في الخلفية...", {
        source: "الشبكة"
      });
      while (transcriptionQueue.length > 0) {
        const item = transcriptionQueue.shift();
        processAudioTranscriptionBlob(item.blob, item.deps);
      }
    }
  });
}

/**
 * تحويل FileReader إلى Promise لضمان الانتظار الصحيح لاكتمال القراءة
 * @param {Blob} blob
 * @returns {Promise<string>} base64 data without the data: prefix
 */
function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.error) {
        reject(reader.error);
        return;
      }
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader did not return a string"));
        return;
      }
      const base64data = result.split(",")[1];
      if (!base64data) {
        reject(new Error("Failed to extract base64 data from FileReader result"));
        return;
      }
      resolve(base64data);
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

/**
 * @typedef {Object} TranscriptionDeps
 * ...
 */

/**
 * Reads the audio blob, triggers remote speech-to-text AI transcription, processes grammar/translation, and writes the output.
 * Handles sequence matching to ignore aborted or out-of-order transcription runs.
 * @param {Blob} blob - Audio recording blob
 * @param {TranscriptionDeps} deps - Contextual action dependencies
 */
export async function processAudioTranscriptionBlob(blob, deps) {
  if (!networkListenerRegistered) {
    networkListenerRegistered = true;
    registerNetworkListener(deps);
  }

  const thisId = ++currentTranscriptionId;

  try {
    // [FIX] استخدام Promise بدلاً من callback لضمان انتظار اكتمال القراءة
    const base64data = await readBlobAsBase64(blob);

    if (thisId !== currentTranscriptionId) return;

    if (appState.get("backgroundRecordingEnabled")) {
      deps.invoke("show_hud_notification", { icon: "⏳", text: "جاري تفريغ الصوت وتحليله..." }).catch(() => {});
    }

    // [FIX] إزالة retryAsync الذي يُسبب تأخيراً مزدوجاً، واستبداله باستدعاء مباشر
    // الـ retry في حالات الشبكة يُعالج عبر networkListenerRegistered
    let text;
    try {
      text = await deps.invoke("ai_transcribe", {
        apiKey: deps.getActiveApiKey(),
        provider: deps.getActiveProvider(),
        model: deps.getSpeechModel(),
        audioBase64: base64data,
        language: deps.getSpeechLanguage()
      });
    } catch (transcribeErr) {
      // في حالة فشل مؤقت، حاول مرة واحدة إضافية فقط
      console.warn("[cloudTranscription] First attempt failed, retrying once:", transcribeErr);
      await new Promise(r => setTimeout(r, 500));
      if (thisId !== currentTranscriptionId) return;
      text = await deps.invoke("ai_transcribe", {
        apiKey: deps.getActiveApiKey(),
        provider: deps.getActiveProvider(),
        model: deps.getSpeechModel(),
        audioBase64: base64data,
        language: deps.getSpeechLanguage()
      });
    }

    if (thisId !== currentTranscriptionId) return;

    if (!text || !text.trim()) {
      deps.setStatus("جاهز للبدء");
      if (appState.get("backgroundRecordingEnabled")) {
        deps.invoke("show_hud_notification", { icon: "🎙️", text: "لم يتم التعرف على أي كلام." }).catch(() => {});
      } else {
        deps.addAppAlert("warning", "لم يتم التعرف على الكلام", "الميكروفون لم يلتقط أي كلام واضح.", {
          source: "تحويل الصوت"
        });
      }
      return;
    }

    const processedText = await deps.applyAutomaticTextProcessing(text, {
      autoTranslate: deps.getVoiceTranslationEnabled?.() || false,
      autoGrammar: deps.getAutoGrammar(),
      autoDiacritize: deps.getAutoDiacritize(),
      activeApiKey: deps.getActiveApiKey(),
      textModel: deps.getTextModel(),
      invoke: deps.invoke,
      getDiacritizeConfig: deps.getDiacritizeConfig,
      setStatus: deps.setStatus
    });

    if (thisId !== currentTranscriptionId) return;

    const outputRoute = deps.resolveTextOutputRoute({
      textOutputTarget: deps.getTextOutputTarget(),
      isTauri: deps.isTauri,
      externalTargetCaptured: deps.getExternalTargetCaptured()
    });

    if (thisId !== currentTranscriptionId) return;

    if (outputRoute.shouldApplyToApp) {
      deps.applyResultText(processedText);
    }
    deps.setStatus(outputRoute.redirectedToApp
      ? "🟢 تم التحويل — وُضع النص داخل التطبيق (لم تُحدَّد نافذة خارجية للّصق)."
      : "🟢 تمت الترجمة والمعالجة بنجاح!");

    if (appState.get("backgroundRecordingEnabled")) {
      deps.invoke("show_hud_notification", { icon: "🟢", text: "تم إلصاق النص بنجاح." }).catch(() => {});
    } else {
      deps.addAppAlert("success", "تم تحويل الصوت إلى نص", processedText.slice(0, 120), {
        source: "تحويل الصوت"
      });
    }

    if (outputRoute.canWriteExternal) {
      await deps.writeTextToExternalTarget(processedText, {
        invoke: deps.invoke,
        simulateTyping: deps.shouldSimulateTyping()
      });
    }

    if (thisId !== currentTranscriptionId) return;

    if (deps.getVoiceTranslationEnabled?.() && deps.speakText) {
      deps.speakText(processedText);
    }
  } catch (err) {
    if (thisId !== currentTranscriptionId) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      transcriptionQueue.push({ blob, deps });
      deps.setStatus("📶 وضع غير متصل: تم حفظ التسجيل في قائمة الانتظار، وسيتم رفعه تلقائياً فور عودة الإنترنت.");
      if (appState.get("backgroundRecordingEnabled")) {
        deps.invoke("show_hud_notification", { icon: "📶", text: "لا يوجد اتصال بالإنترنت، تم حفظ التسجيل مؤقتاً." }).catch(() => {});
      } else {
        deps.addAppAlert("warning", "لا يوجد اتصال بالإنترنت", "تم حفظ التسجيل الصوتي في قائمة الانتظار للرفع التلقائي لاحقاً.", {
          source: "تحويل الصوت"
        });
      }
      return;
    }

    console.error("[Transcription Error] Failed to transcribe audio:", err);
    deps.addAppAlert("error", "فشل تحويل الصوت إلى نص", err, {
      source: "تحويل الصوت"
    });
    deps.setStatus("❌ فشل التحويل: " + err);
    if (appState.get("backgroundRecordingEnabled")) {
      const errStr = String(err);
      const icon = errStr.includes("API") ? "🔑" : "❌";
      deps.invoke("show_hud_notification", { icon, text: "فشل التحويل: " + err }).catch(() => {});
    }
  }
}
