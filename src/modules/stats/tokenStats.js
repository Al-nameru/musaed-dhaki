import { invoke } from "../../shared/tauriClient.js";

function actionLabel(action) {
  if (action === "transcribe") return "🎙️ تفريغ صوت";
  if (action === "grammar") return "✍️ تدقيق إملائي";
  if (action === "diacritize") return "✏️ تشكيل حركات";
  if (action === "translate") return "🌐 ترجمة فورية";
  if (action === "summarize") return "📝 تلخيص نص";
  return action;
}

export async function loadTokenStats() {
  try {
    const stats = await invoke("get_token_usage_stats");

    // 1. تحديث العدادات الرئيسية (الطريقتين معاً)
    const totalTokens = stats.total_prompt_tokens + stats.total_completion_tokens;
    document.getElementById("stats-total-tokens").textContent = totalTokens.toLocaleString();
    document.getElementById("stats-prompt-tokens").textContent = stats.total_prompt_tokens.toLocaleString();
    document.getElementById("stats-completion-tokens").textContent = stats.total_completion_tokens.toLocaleString();

    const totalWords = (stats.total_prompt_words || 0) + (stats.total_completion_words || 0);
    const totalChars = (stats.total_prompt_chars || 0) + (stats.total_completion_chars || 0);
    const totalRequests = stats.total_requests || 0;

    const totalWordsEl = document.getElementById("stats-total-words");
    if (totalWordsEl) totalWordsEl.textContent = totalWords.toLocaleString();
    
    const totalCharsEl = document.getElementById("stats-total-chars");
    if (totalCharsEl) totalCharsEl.textContent = totalChars.toLocaleString();

    const totalRequestsEl = document.getElementById("stats-total-requests");
    if (totalRequestsEl) totalRequestsEl.textContent = totalRequests.toLocaleString();

    const approxCost = (stats.total_prompt_tokens * 0.0000015) + (stats.total_completion_tokens * 0.0000045);
    document.getElementById("stats-approx-cost").textContent = `$${approxCost.toFixed(5)}`;

    // 2. تحديث جدول المزودين
    const providersTbody = document.getElementById("stats-providers-tbody");
    providersTbody.innerHTML = "";
    const providersList = Object.entries(stats.providers);
    if (providersList.length === 0) {
      providersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:12px;">لا يوجد استهلاك مسجل حالياً.</td></tr>`;
    } else {
      providersList.forEach(([provider, usage]) => {
        const pTotalTokens = usage.prompt_tokens + usage.completion_tokens;
        const pTotalWords = (usage.prompt_words || 0) + (usage.completion_words || 0);
        const pTotalChars = (usage.prompt_chars || 0) + (usage.completion_chars || 0);
        const pRequests = usage.request_count || 0;
        const pApproxCost = (usage.prompt_tokens * 0.0000015) + (usage.completion_tokens * 0.0000045);

        const row = document.createElement("tr");
        row.innerHTML = `
          <td style="padding:10px 8px; font-weight:600;">${provider}</td>
          <td style="padding:10px 8px;">${pRequests.toLocaleString()}</td>
          <td style="padding:10px 8px;">${pTotalWords.toLocaleString()} كلمة</td>
          <td style="padding:10px 8px;">${pTotalChars.toLocaleString()} حرف</td>
          <td style="padding:10px 8px; font-weight:700; color:var(--accent);">${pTotalTokens.toLocaleString()}</td>
          <td style="padding:10px 8px; font-weight:600; color:#ffb03a;">$${pApproxCost.toFixed(5)}</td>
        `;
        providersTbody.appendChild(row);
      });
    }

    // 3. تحديث جدول النماذج
    const modelsTbody = document.getElementById("stats-models-tbody");
    modelsTbody.innerHTML = "";
    const modelsList = Object.entries(stats.models);
    if (modelsList.length === 0) {
      modelsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:12px;">لا يوجد استهلاك مسجل حالياً.</td></tr>`;
    } else {
      modelsList.forEach(([model, usage]) => {
        const mTotalTokens = usage.prompt_tokens + usage.completion_tokens;
        const mTotalWords = (usage.prompt_words || 0) + (usage.completion_words || 0);
        const mTotalChars = (usage.prompt_chars || 0) + (usage.completion_chars || 0);
        const mRequests = usage.request_count || 0;
        const mApproxCost = (usage.prompt_tokens * 0.0000015) + (usage.completion_tokens * 0.0000045);

        const row = document.createElement("tr");
        row.innerHTML = `
          <td style="padding:10px 8px; font-family:monospace;">${model}</td>
          <td style="padding:10px 8px;">${mRequests.toLocaleString()}</td>
          <td style="padding:10px 8px;">${mTotalWords.toLocaleString()} كلمة</td>
          <td style="padding:10px 8px;">${mTotalChars.toLocaleString()} حرف</td>
          <td style="padding:10px 8px; font-weight:700; color:var(--accent);">${mTotalTokens.toLocaleString()}</td>
          <td style="padding:10px 8px; font-weight:600; color:#ffb03a;">$${mApproxCost.toFixed(5)}</td>
        `;
        modelsTbody.appendChild(row);
      });
    }

    // 4. تحديث جدول السجل التاريخي
    const historyTbody = document.getElementById("stats-history-tbody");
    historyTbody.innerHTML = "";
    const historyList = [...stats.history].reverse();
    if (historyList.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:12px;">لا يوجد عمليات مسجلة في السجل التاريخي.</td></tr>`;
    } else {
      historyList.forEach(entry => {
        const date = new Date(entry.timestamp * 1000);
        const timeStr = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) + " " + date.toLocaleDateString([], { month: "short", day: "numeric" });

        const row = document.createElement("tr");
        const entryWords = (entry.prompt_words || 0) + (entry.completion_words || 0);
        const entryChars = (entry.prompt_chars || 0) + (entry.completion_chars || 0);

        row.innerHTML = `
          <td style="padding:10px 8px; color:var(--text-muted); font-size:11.5px;">${timeStr}</td>
          <td style="padding:10px 8px; font-weight:600;">${entry.provider}</td>
          <td style="padding:10px 8px; font-family:monospace; font-size:11.5px;">${entry.model}</td>
          <td style="padding:10px 8px;">${actionLabel(entry.action)}</td>
          <td style="padding:10px 8px; font-size:12px;">📝 ${entryWords} | 🔤 ${entryChars}</td>
          <td style="padding:10px 8px; font-weight:600; color:#6edcff;">${(entry.prompt_tokens + entry.completion_tokens).toLocaleString()}</td>
        `;
        historyTbody.appendChild(row);
      });
    }
  } catch (err) {
    console.error("Failed to load token stats:", err);
  }
}

export function setupTokenStatsReset() {
  document.getElementById("btn-reset-stats")?.addEventListener("click", async () => {
    if (confirm("هل أنت متأكد من رغبتك في تصفير عداد التوكينز ومسح كافة إحصائيات الاستهلاك وسجل العمليات؟ لا يمكن التراجع عن هذا الإجراء.")) {
      try {
        await invoke("reset_token_usage_stats");
        await loadTokenStats();
        alert("تم تصفير عداد الاستهلاك بنجاح.");
      } catch (err) {
        alert("فشل تصفير العداد: " + err);
      }
    }
  });
}
