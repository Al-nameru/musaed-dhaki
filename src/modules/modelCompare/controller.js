import {
  createModelCompareColumn as createModelCompareColumnElement,
  refreshModelComparisonOptions as refreshModelComparisonColumnOptions
} from "./columns.js";
import {
  clearCompareAnswers as clearCompareAnswersFlow,
  runModelComparison as runModelComparisonFlow,
  runSingleCompareColumn as runSingleCompareColumnFlow
} from "./flow.js";
import {
  buildCompareQuestionWithAttachments,
  renderCompareAttachments
} from "./attachments.js";
import { applyCompareLayout } from "./layout.js";
import { setupModelComparisonView } from "./setup.js";

export function createModelComparisonController(deps) {
  let activeAbortController = null;

  const refs = {
    compareQuestionInput: null,
    btnRunModelCompare: null,
    btnAddCompareColumn: null,
    modelCompareColumns: null,
    modelCompareStatus: null
  };

  const getColumnDeps = () => ({
    getProviders: deps.getComparisonProviders,
    getKeys: deps.getComparisonKeys,
    getModels: deps.getComparisonModels,
    onLayout: applyCurrentLayout,
    onStatus: setStatus,
    onCopyError: () => setStatus("تعذّر النسخ إلى الحافظة.", true),
    getQuestion: () => refs.compareQuestionInput?.value.trim() || "",
    runColumn: runSingleColumn,
    buildQuestion: buildCompareQuestionWithAttachments
  });

  const createColumn = (config = {}) => {
    return createModelCompareColumnElement(refs.modelCompareColumns, config, getColumnDeps());
  };

  const setStatus = (message, isError = false, state = "") => {
    if (!refs.modelCompareStatus) return;
    refs.modelCompareStatus.textContent = message;
    refs.modelCompareStatus.classList.remove("is-error", "is-done");
    if (isError) refs.modelCompareStatus.classList.add("is-error");
    else if (state === "done") refs.modelCompareStatus.classList.add("is-done");
  };

  const applyCurrentLayout = () => {
    applyCompareLayout(refs.modelCompareColumns, setStatus);
  };

  const runSingleColumn = async (card, question, signal) => {
    return runSingleCompareColumnFlow(card, question, {
      invoke: deps.invoke,
      getProviderKey: deps.getProviderKey,
      getErrorMessage: deps.getErrorMessage,
      signal
    });
  };

  const runComparison = async () => {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    try {
      await runModelComparisonFlow({
        container: refs.modelCompareColumns,
        runButton: refs.btnRunModelCompare,
        getQuestion: () => refs.compareQuestionInput?.value.trim() || "",
        focusQuestion: () => refs.compareQuestionInput?.focus(),
        setStatus,
        buildQuestion: buildCompareQuestionWithAttachments,
        runColumn: (card, q) => runSingleColumn(card, q, signal),
        signal
      });
    } finally {
      if (activeAbortController?.signal === signal) {
        activeAbortController = null;
      }
    }
  };

  const clearAnswers = () => {
    clearCompareAnswersFlow(refs.modelCompareColumns, setStatus);
  };

  const abort = () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
      setStatus("تم إلغاء المقارنة.");
      if (refs.btnRunModelCompare) {
        refs.btnRunModelCompare.disabled = false;
        refs.btnRunModelCompare.classList.remove("is-running");
      }
      if (refs.modelCompareColumns) {
        [...(refs.modelCompareColumns.querySelectorAll(".model-compare-column") || [])].forEach((card) => {
          const answer = card.querySelector(".model-compare-answer");
          if (answer && answer.classList.contains("loading")) {
            answer.className = "model-compare-answer is-empty";
            answer.textContent = "ستظهر إجابة هذا النموذج هنا…";
          }
        });
      }
    }
  };

  const setup = () => {
    setupModelComparisonView({
      setRefs: (nextRefs) => {
        Object.assign(refs, nextRefs);
      },
      createColumn,
      getProviders: deps.getComparisonProviders,
      applyLayout: applyCurrentLayout,
      setStatus,
      runComparison,
      clearAnswers
    });
  };

  const refreshOptions = () => {
    refreshModelComparisonColumnOptions(refs.modelCompareColumns, getColumnDeps());
  };

  return {
    createColumn,
    setStatus,
    applyCurrentLayout,
    runSingleColumn,
    runComparison,
    clearAnswers,
    setup,
    refreshOptions,
    renderAttachments: renderCompareAttachments,
    abort
  };
}
