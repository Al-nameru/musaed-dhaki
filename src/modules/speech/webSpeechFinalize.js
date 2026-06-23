import { appState } from "../../shared/appState.js";

export async function finalizeWebSpeechSessionFlow(deps) {
  deps.setIsRecording(false);
  deps.setRecordingState("idle");
  deps.setManualStopRequested(false);
  deps.setRecognitionInstance(null);
  deps.setRecordButtonRecording(false);
  deps.playStopBeepSound();

  const spoken = deps.getWebSpeechFinal().trim();
  if (!spoken) {
    deps.setStatus("جاهز للبدء");
    if (appState.get("backgroundRecordingEnabled")) {
      deps.invoke("show_hud_notification", { icon: "🎙️", text: "لم يتم التعرف على أي كلام." }).catch(() => {});
    } else {
      deps.addAppAlert("warning", "لم يتم التعرف على الكلام", "لم يتم التقاط أي صوت واضح عبر Google Web Speech.", {
        source: "Google Web Speech"
      });
    }
    return;
  }

  try {
    if (appState.get("backgroundRecordingEnabled")) {
      deps.invoke("show_hud_notification", { icon: "⏳", text: "جاري تفريغ الصوت وتحليله..." }).catch(() => {});
    }
    deps.setStatus("⏳ جاري المعالجة والتدقيق التلقائي...");
    const processedText = await deps.applyAutomaticTextProcessing(spoken, {
      autoGrammar: deps.getAutoGrammar(),
      autoDiacritize: deps.getAutoDiacritize(),
      activeApiKey: deps.getActiveApiKey(),
      textModel: deps.getTextModel(),
      invoke: deps.invoke,
      getDiacritizeConfig: deps.getDiacritizeConfig,
      setStatus: deps.setStatus
    });

    const outputRoute = deps.resolveTextOutputRoute({
      textOutputTarget: deps.getTextOutputTarget(),
      isTauri: deps.isTauri,
      externalTargetCaptured: deps.getExternalTargetCaptured()
    });

    if (outputRoute.shouldApplyToApp) {
      deps.setSuppressResultTextInput(true);
      const originalText = deps.getWebSpeechOriginalText ? deps.getWebSpeechOriginalText() : "";
      deps.setResultText(originalText);
      deps.applyResultText(processedText);
      deps.setSuppressResultTextInput(false);
    }

    deps.setStatus(outputRoute.redirectedToApp
      ? "🟢 تم التعرف — وُضع النص داخل التطبيق (لم تُحدَّد نافذة خارجية للّصق)."
      : "🟢 تمت الترجمة والمعالجة بنجاح!");

    if (appState.get("backgroundRecordingEnabled")) {
      deps.invoke("show_hud_notification", { icon: "🟢", text: "تم إلصاق النص بنجاح." }).catch(() => {});
    } else {
      deps.addAppAlert("success", "تم التعرف على الكلام", processedText.slice(0, 120), {
        source: "Google Web Speech"
      });
    }

    if (outputRoute.canWriteExternal) {
      await deps.writeTextToExternalTarget(processedText, {
        invoke: deps.invoke,
        simulateTyping: deps.shouldSimulateTyping()
      });
    }
  } catch (err) {
    console.error("finalizeWebSpeechSessionFlow failed:", err);
    deps.setStatus("❌ فشل معالجة الصوت: " + err);
    if (appState.get("backgroundRecordingEnabled")) {
      const errStr = String(err);
      const icon = errStr.includes("API") ? "🔑" : "❌";
      deps.invoke("show_hud_notification", { icon, text: "فشل المعالجة: " + err }).catch(() => {});
    } else {
      deps.addAppAlert("error", "فشل معالجة الصوت", err, {
        source: "Google Web Speech"
      });
    }
  }
}
