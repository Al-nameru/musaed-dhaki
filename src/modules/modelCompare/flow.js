import { mcGetParts, mcSetAnswer, mcSetError, mcSetLoading } from "./rendering.js";

const MODEL_COMPARE_PROMPT = "أجب عن السؤال التالي مباشرة وبوضوح. لا تذكر أنك نموذج ذكاء اصطناعي إلا إذا كان ذلك ضرورياً للسؤال. حافظ على لغة السؤال قدر الإمكان.";

// إرسال السؤال إلى عمود واحد؛ يُرجِع زمن الاستجابة (مللي ثانية) أو null عند الفشل.
export async function runSingleCompareColumn(card, question, deps) {
  const { provider, model, key } = mcGetParts(card);
  const apiKey = key || deps.getProviderKey(provider);
  if (!apiKey) {
    mcSetError(card, `لا يوجد مفتاح API محفوظ للمزود ${provider}. أضِف المفتاح من تبويب مفاتيح الذكاء الاصطناعي أولاً.`);
    return null;
  }
  const signal = deps.signal;
  if (signal && signal.aborted) return null;

  mcSetLoading(card);
  const started = performance.now();
  try {
    const result = await deps.invoke("ai_process_text", {
      apiKey,
      model,
      action: "compare",
      text: question,
      customPrompt: MODEL_COMPARE_PROMPT
    });
    if (signal && signal.aborted) return null;

    const latency = performance.now() - started;
    let tokens = null;
    let totalTokens = null;
    try {
      const stats = await deps.invoke("get_token_usage_stats");
      if (stats) {
        if (stats.history && stats.history.length > 0) {
          const entry = [...stats.history].reverse().find(e => e.model === model);
          if (entry) {
            tokens = (entry.prompt_tokens || 0) + (entry.completion_tokens || 0);
          }
        }
        if (stats.models && stats.models[model]) {
          const mUsage = stats.models[model];
          totalTokens = (mUsage.prompt_tokens || 0) + (mUsage.completion_tokens || 0);
        }
      }
    } catch (e) {
      console.error("Failed to fetch tokens from stats history:", e);
    }
    mcSetAnswer(card, (result || "").trim(), latency, tokens, totalTokens);
    return latency;
  } catch (err) {
    if (signal && signal.aborted) return null;
    mcSetError(card, deps.getErrorMessage(err));
    return null;
  }
}

export async function runModelComparison(options) {
  const rawQuestion = options.getQuestion();
  if (!rawQuestion) {
    options.setStatus("اكتب سؤالاً أولاً.", true);
    options.focusQuestion();
    return;
  }
  const question = options.buildQuestion(rawQuestion);
  const signal = options.signal;

  const cards = [...(options.container?.querySelectorAll(".model-compare-column") || [])];
  if (!cards.length) {
    options.setStatus("أضف عموداً واحداً على الأقل.", true);
    return;
  }

  const total = cards.length;
  let done = 0;
  options.setStatus(`جارٍ الإرسال إلى النماذج… (0/${total})`);
  if (options.runButton) {
    options.runButton.disabled = true;
    options.runButton.classList.add("is-running");
  }

  const results = await Promise.all(cards.map(async (card) => {
    const latency = await options.runColumn(card, question);
    if (signal && signal.aborted) return { card, latency: null };
    done += 1;
    if (options.runButton && options.runButton.disabled) {
      options.setStatus(`جارٍ الإرسال إلى النماذج… (${done}/${total})`);
    }
    return { card, latency };
  }));

  if (signal && signal.aborted) return;

  const successful = results.filter((r) => typeof r.latency === "number");
  if (successful.length > 1) {
    const fastest = successful.reduce((a, b) => (b.latency < a.latency ? b : a));
    fastest.card.classList.add("is-fastest");
    const badge = fastest.card.querySelector(".mc-fastest-badge");
    if (badge) badge.hidden = false;
  }

  if (options.runButton) {
    options.runButton.disabled = false;
    options.runButton.classList.remove("is-running");
  }

  const okCount = successful.length;
  options.setStatus(
    okCount === total ? `اكتملت المقارنة (${total}/${total}).` : `اكتملت المقارنة — نجح ${okCount} من ${total}.`,
    false,
    okCount > 0 ? "done" : ""
  );
}

export function clearCompareAnswers(container, setStatus) {
  [...(container?.querySelectorAll(".model-compare-column") || [])].forEach((card) => {
    const p = mcGetParts(card);
     card.classList.remove("is-fastest");
    card._mcAnswerText = "";
    card._mcLatency = null;
    card._mcTotalTokens = null;
    if (p.answer) {
      p.answer.className = "model-compare-answer is-empty";
      p.answer.textContent = "ستظهر إجابة هذا النموذج هنا…";
    }
    if (p.latency) p.latency.hidden = true;
    if (p.words) p.words.hidden = true;
    if (p.chars) p.chars.hidden = true;
    if (p.tokens) p.tokens.hidden = true;
    if (p.fastest) p.fastest.hidden = true;
    if (p.copyBtn) p.copyBtn.disabled = true;
    if (p.retryBtn) p.retryBtn.disabled = true;
  });
  setStatus("تم مسح الإجابات.");
}
