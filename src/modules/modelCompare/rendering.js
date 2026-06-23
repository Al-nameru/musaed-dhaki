const MC_PROVIDER_META = {
  Groq: "#f55036",
  Gemini: "#4285f4",
  OpenAI: "#10a37f",
  Anthropic: "#d97757",
  DeepSeek: "#4d6bfe",
  Mistral: "#fa520f",
  OpenRouter: "#8b5cf6",
  xAI: "#cbd5e1"
};

function mcProviderColor(provider) {
  return MC_PROVIDER_META[provider] || "var(--accent)";
}

function mcEscapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

export function mcRenderMarkdown(raw) {
  const source = String(raw ?? "");
  const codeBlocks = [];
  let work = source.replace(/```[ \t]*[\w+#.-]*\n?([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.push(mcEscapeHtml(code.replace(/\n$/, ""))) - 1;
    return `@@MCCODE${idx}@@`;
  });

  work = mcEscapeHtml(work);
  work = work.replace(/`([^`\n]+)`/g, (_m, c) => `<code class="mc-inline-code">${c}</code>`);
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  work = work.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = work.split("\n");
  const out = [];
  let listType = null;
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    let match;
    if ((match = line.match(/^@@MCCODE(\d+)@@$/))) {
      closeList();
      out.push(`<pre class="mc-code"><code>${codeBlocks[Number(match[1])]}</code></pre>`);
    } else if ((match = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const level = match[1].length;
      out.push(`<h${level}>${match[2]}</h${level}>`);
    } else if (/^(---|\*\*\*|___)$/.test(line)) {
      closeList();
      out.push("<hr>");
    } else if ((match = line.match(/^&gt;\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote>${match[1]}</blockquote>`);
    } else if ((match = line.match(/^\d+[.)]\s+(.*)$/))) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${match[1]}</li>`);
    } else if ((match = line.match(/^[-*+•]\s+(.*)$/))) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${match[1]}</li>`);
    } else {
      closeList();
      out.push(`<p>${line}</p>`);
    }
  }
  closeList();

  return out.join("\n").replace(/@@MCCODE(\d+)@@/g,
    (_m, i) => `<pre class="mc-code"><code>${codeBlocks[Number(i)]}</code></pre>`);
}

window.mcRenderMarkdown = mcRenderMarkdown;

function mcCountWords(text) {
  const value = String(text || "").trim();
  return value ? (value.match(/\S+/g) || []).length : 0;
}

function mcFormatLatency(ms) {
  return `${(ms / 1000).toFixed(1)} ث`;
}

export function mcGetParts(card) {
  return {
    answer: card.querySelector(".model-compare-answer"),
    latency: card.querySelector(".mc-meta-latency"),
    words: card.querySelector(".mc-meta-words"),
    chars: card.querySelector(".mc-meta-chars"),
    tokens: card.querySelector(".mc-meta-tokens"),
    fastest: card.querySelector(".mc-fastest-badge"),
    copyBtn: card.querySelector(".btn-copy-compare"),
    retryBtn: card.querySelector(".btn-retry-compare"),
    provider: card.querySelector(".compare-provider-select")?.value || "",
    key: card.querySelector(".compare-key-select")?.value || "",
    model: card.querySelector(".compare-model-select")?.value || ""
  };
}

export function mcSetLoading(card) {
  const parts = mcGetParts(card);
  card.classList.remove("is-fastest");
  card._mcAnswerText = "";
  card._mcLatency = null;
  card._mcTokens = null;
  if (parts.answer) {
    parts.answer.className = "model-compare-answer loading";
    parts.answer.innerHTML = `<div class="mc-skeleton">${"<div class='mc-skeleton-line'></div>".repeat(5)}</div>`;
  }
  if (parts.latency) parts.latency.hidden = true;
  if (parts.words) parts.words.hidden = true;
  if (parts.chars) parts.chars.hidden = true;
  if (parts.tokens) parts.tokens.hidden = true;
  if (parts.fastest) parts.fastest.hidden = true;
  if (parts.copyBtn) parts.copyBtn.disabled = true;
  if (parts.retryBtn) parts.retryBtn.disabled = true;
}

export function mcSetAnswer(card, text, latencyMs, tokens = null, totalTokens = null) {
  const parts = mcGetParts(card);
  const clean = text || "لم يرجع النموذج إجابة.";
  card._mcAnswerText = clean;
  card._mcLatency = (typeof latencyMs === "number") ? latencyMs : null;
  card._mcTokens = (typeof tokens === "number") ? tokens : null;
  card._mcTotalTokens = (typeof totalTokens === "number") ? totalTokens : null;

  if (parts.answer) {
    parts.answer.className = "model-compare-answer";
    parts.answer.innerHTML = mcRenderMarkdown(clean);
  }
  if (parts.latency && card._mcLatency != null) {
    parts.latency.hidden = false;
    parts.latency.textContent = `⏱ ${mcFormatLatency(card._mcLatency)}`;
  }
  if (parts.words) {
    parts.words.hidden = false;
    parts.words.textContent = `📝 ${mcCountWords(clean)} كلمة`;
  }
  if (parts.chars) {
    parts.chars.hidden = false;
    parts.chars.textContent = `🔤 ${clean.length} حرف`;
  }
  if (parts.tokens && card._mcTokens != null) {
    parts.tokens.hidden = false;
    let label = `🪙 ${card._mcTokens} توكين`;
    if (card._mcTotalTokens != null) {
      label += ` (إجمالي: ${card._mcTotalTokens.toLocaleString()})`;
    }
    parts.tokens.textContent = label;
  }
  if (parts.fastest) parts.fastest.hidden = true;
  if (parts.copyBtn) parts.copyBtn.disabled = false;
  if (parts.retryBtn) parts.retryBtn.disabled = false;
}

export function mcSetError(card, message) {
  const parts = mcGetParts(card);
  card.classList.remove("is-fastest");
  card._mcAnswerText = "";
  card._mcLatency = null;
  card._mcTokens = null;
  if (parts.answer) {
    parts.answer.className = "model-compare-answer error";
    parts.answer.textContent = "⚠ " + message;
  }
  if (parts.latency) parts.latency.hidden = true;
  if (parts.words) parts.words.hidden = true;
  if (parts.chars) parts.chars.hidden = true;
  if (parts.tokens) parts.tokens.hidden = true;
  if (parts.copyBtn) parts.copyBtn.disabled = true;
  if (parts.retryBtn) parts.retryBtn.disabled = false;
}

export async function copyCompareAnswer(card, btn, onError = () => {}) {
  const text = card?._mcAnswerText || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const original = btn.textContent;
      btn.classList.add("is-copied");
      btn.textContent = "✓";
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.textContent = original;
      }, 1200);
    }
  } catch (err) {
    console.error("نسخ إجابة المقارنة فشل:", err);
    onError(err);
  }
}

export function updateCompareBadge(card) {
  const provider = card.querySelector(".compare-provider-select")?.value || "";
  const badge = card.querySelector(".mc-provider-badge");
  const badgeName = card.querySelector(".mc-provider-name");
  if (badge) badge.style.setProperty("--mc-provider-color", mcProviderColor(provider));
  if (badgeName) badgeName.textContent = provider || badgeName.textContent;
}
