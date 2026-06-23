import {
  renderCompareAttachments,
  setupCompareAttachmentControls
} from "./attachments.js";
import { setupCompareLayoutControls } from "./layout.js";

export function setupModelComparisonView(options) {
  const refs = {
    compareQuestionInput: document.getElementById("textarea-compare-question"),
    btnRunModelCompare: document.getElementById("btn-run-model-compare"),
    btnAddCompareColumn: document.getElementById("btn-add-compare-column"),
    modelCompareColumns: document.getElementById("model-compare-columns"),
    modelCompareStatus: document.getElementById("model-compare-status")
  };
  options.setRefs(refs);

  const {
    compareQuestionInput,
    btnRunModelCompare,
    btnAddCompareColumn,
    modelCompareColumns
  } = refs;

  if (!modelCompareColumns) return refs;

  if (modelCompareColumns.dataset.ready !== "true") {
    modelCompareColumns.dataset.ready = "true";
    options.createColumn();
    const providers = options.getProviders();
    options.createColumn({ provider: providers[1] || providers[0] || "" });
  }

  if (modelCompareColumns.dataset.controlsReady === "true") {
    options.applyLayout();
    renderCompareAttachments();
    return refs;
  }
  modelCompareColumns.dataset.controlsReady = "true";

  btnAddCompareColumn?.addEventListener("click", () => options.createColumn());
  btnRunModelCompare?.addEventListener("click", options.runComparison);

  document.getElementById("btn-clear-compare")?.addEventListener("click", options.clearAnswers);
  setupCompareLayoutControls(modelCompareColumns, options.setStatus);
  const questionCard = document.querySelector(".model-compare-question-card");
  setupCompareAttachmentControls({
    onAdded: (count) => options.setStatus(`تمت إضافة ${count} مرفق.`)
  });

  const counter = document.getElementById("mc-char-counter");
  if (compareQuestionInput && counter) {
    const updateCounter = () => {
      counter.textContent = `${compareQuestionInput.value.length} حرف`;
    };
    compareQuestionInput.addEventListener("input", updateCounter);
    updateCounter();
  }

  const toggleQuestionBtn = document.getElementById("btn-toggle-compare-question");
  const lockQuestionSizeBtn = document.getElementById("btn-lock-compare-question-size");
  const setQuestionSizeLocked = (isLocked) => {
    questionCard?.classList.toggle("is-size-locked", isLocked);
    if (lockQuestionSizeBtn) {
      lockQuestionSizeBtn.classList.toggle("is-locked", isLocked);
      lockQuestionSizeBtn.setAttribute("aria-pressed", String(isLocked));
      lockQuestionSizeBtn.title = isLocked ? "إلغاء تثبيت حجم صندوق النص" : "تثبيت حجم صندوق النص";
      lockQuestionSizeBtn.setAttribute(
        "aria-label",
        isLocked ? "إلغاء تثبيت حجم صندوق النص" : "تثبيت حجم صندوق النص"
      );
    }
    localStorage.setItem("bm_compare_question_size_locked", String(isLocked));
  };
  setQuestionSizeLocked(localStorage.getItem("bm_compare_question_size_locked") === "true");
  lockQuestionSizeBtn?.addEventListener("click", () => {
    setQuestionSizeLocked(!questionCard?.classList.contains("is-size-locked"));
  });

  const setQuestionOpen = (isOpen) => {
    questionCard?.classList.toggle("is-question-collapsed", !isOpen);
    if (toggleQuestionBtn) {
      toggleQuestionBtn.setAttribute("aria-expanded", String(isOpen));
      toggleQuestionBtn.title = isOpen ? "إغلاق صندوق النص" : "فتح صندوق النص";
    }
    localStorage.setItem("bm_compare_question_open", String(isOpen));
  };
  setQuestionOpen(localStorage.getItem("bm_compare_question_open") !== "false");
  toggleQuestionBtn?.addEventListener("click", () => {
    const isOpen = !questionCard?.classList.contains("is-question-collapsed");
    setQuestionOpen(!isOpen);
  });

  // الإملاء الصوتي لصندوق السؤال باستخدام Web Speech API
  const dictateBtn = document.getElementById("btn-dictate-compare-question");
  if (dictateBtn && compareQuestionInput) {
    let recognition = null;
    let isDictating = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      const stopDictation = () => {
        if (!isDictating) return;
        isDictating = false;
        dictateBtn.style.background = "";
        dictateBtn.style.borderColor = "";
        dictateBtn.title = "إملاء صوتي";
        try {
          recognition.stop();
        } catch (e) {}
        options.setStatus("تم إيقاف الإملاء الصوتي.");
      };

      const startDictation = () => {
        if (isDictating) return;
        let lang = localStorage.getItem("bm_speech_language") || "ar-SA";
        if (lang === "ar") lang = "ar-SA";
        if (lang === "en") lang = "en-US";
        recognition.lang = lang;

        isDictating = true;
        dictateBtn.style.background = "rgba(239, 68, 68, 0.25)";
        dictateBtn.style.borderColor = "var(--danger)";
        dictateBtn.title = "جاري الاستماع... انقر للإيقاف";
        options.setStatus("🎤 جاري الاستماع للإملاء الصوتي...");

        try {
          recognition.start();
        } catch (e) {
          console.error("Speech start failed:", e);
          stopDictation();
        }
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          const space = compareQuestionInput.value && !compareQuestionInput.value.endsWith(" ") ? " " : "";
          compareQuestionInput.value += space + finalTranscript;
          compareQuestionInput.dispatchEvent(new Event("input"));
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") {
          console.error("Speech recognition error:", event.error);
          options.setStatus(`⚠️ خطأ في الإملاء: ${event.error}`, true);
          stopDictation();
        }
      };

      recognition.onend = () => {
        if (isDictating) {
          stopDictation();
        }
      };

      dictateBtn.addEventListener("click", () => {
        if (isDictating) {
          stopDictation();
        } else {
          startDictation();
        }
      });
    } else {
      dictateBtn.style.opacity = "0.5";
      dictateBtn.title = "الإملاء الصوتي غير مدعوم في هذا المتصفح";
      dictateBtn.addEventListener("click", () => {
        options.setStatus("⚠️ الإملاء الصوتي غير مدعوم في هذا النظام.", true);
      });
    }
  }

  compareQuestionInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      options.runComparison();
    }
  });

  return refs;
}
