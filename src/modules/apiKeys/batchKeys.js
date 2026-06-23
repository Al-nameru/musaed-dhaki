import { invoke } from "../../shared/tauriClient.js";

let failedKeys = [];
let getActiveApiKey = () => "";
let onActivateVerifiedKey = () => {};
let onSaveKeyForProvider = () => {};
let onBeforeActivateKey = () => {};

function detectProviderPrefix(key) {
  if (key.startsWith("gsk_")) return "Groq";
  if (key.startsWith("AIzaSy")) return "Gemini";
  if (key.startsWith("sk-ant-")) return "Anthropic";
  if (key.startsWith("sk-or-")) return "OpenRouter";
  if (key.startsWith("xai-")) return "xAI";
  if (key.startsWith("sk-")) return "OpenAI/DeepSeek/Mistral";
  return "فحص تلقائي...";
}

function maskKey(key) {
  if (key.length <= 10) return key;
  return key.substring(0, 6) + "..." + key.slice(-4);
}

function saveKeyToBatchStore(key) {
  let saved = localStorage.getItem("bm_batch_keys");
  let list = saved ? JSON.parse(saved) : [];
  if (!list.includes(key)) {
    list.push(key);
    localStorage.setItem("bm_batch_keys", JSON.stringify(list));
  }
}

function renderBatchRow(key, rowId) {
  const row = document.createElement("tr");
  row.id = rowId;

  if (key === getActiveApiKey()) {
    row.className = "active-key-row";
  }

  row.innerHTML = `
    <td style="font-family: monospace; direction: ltr; text-align: left; padding: 10px 8px;">${maskKey(key)}</td>
    <td class="provider-cell" style="padding: 10px 8px;">${detectProviderPrefix(key)}</td>
    <td class="status-cell" style="padding: 10px 8px;">⏳ جاري الفحص...</td>
    <td class="models-cell" style="padding: 10px 8px;">-</td>
    <td class="control-cell" style="padding: 10px 8px; text-align: center;">-</td>
  `;
  return row;
}

async function verifySingleBatchKey(key, rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  try {
    const res = await invoke("verify_api_key", { key });
    const providerCell = row.querySelector(".provider-cell");
    if (providerCell && res.provider) {
      providerCell.textContent = res.provider;
    }

    if (res.valid) {
      saveKeyToBatchStore(key);
      onSaveKeyForProvider(res.provider, key);
      row.querySelector(".status-cell").innerHTML = "🟢 صالح";
      row.querySelector(".status-cell").style.color = "var(--success)";

      const modelsCell = row.querySelector(".models-cell");
      modelsCell.innerHTML = "";
      res.models.forEach(model => {
        const span = document.createElement("span");
        span.className = "badge-model-tag";
        span.textContent = model;
        modelsCell.appendChild(span);
      });
      if (res.models.length === 0) {
        modelsCell.textContent = "لا يوجد";
      }

      const controlCell = row.querySelector(".control-cell");
      const btn = document.createElement("button");
      btn.className = "btn-activate-key";

      if (key === getActiveApiKey()) {
        btn.textContent = "✓ نشط";
        btn.classList.add("active");
      } else {
        btn.textContent = "تفعيل";
        btn.addEventListener("click", () => {
          onBeforeActivateKey();
          onActivateVerifiedKey(key, res);

          document.querySelectorAll("#batch-results-tbody tr").forEach(r => {
            r.classList.remove("active-key-row");
          });
          document.querySelectorAll(".btn-activate-key").forEach(button => {
            button.textContent = "تفعيل";
            button.classList.remove("active");
          });

          row.classList.add("active-key-row");
          btn.textContent = "✓ نشط";
          btn.classList.add("active");
        });
      }
      controlCell.appendChild(btn);
    } else {
      row.querySelector(".status-cell").innerHTML = "🔴 غير صالح";
      row.querySelector(".status-cell").style.color = "var(--danger)";
      addFailedKey(key);
    }
  } catch (err) {
    row.querySelector(".status-cell").innerHTML = `🔴 خطأ: ${err}`;
    row.querySelector(".status-cell").style.color = "var(--danger)";
    addFailedKey(key);
  }
}

function renderAndVerifyKeys(keys) {
  const batchResultsContainer = document.getElementById("batch-results-container");
  const batchResultsTbody = document.getElementById("batch-results-tbody");
  if (!batchResultsContainer || !batchResultsTbody) return;

  batchResultsContainer.style.display = "block";
  batchResultsTbody.innerHTML = "";

  keys.forEach((key, index) => {
    const rowId = `batch-row-${index}`;
    batchResultsTbody.appendChild(renderBatchRow(key, rowId));
    verifySingleBatchKey(key, rowId);
  });
}

function parseBatchKeys() {
  const batchKeysTextarea = document.getElementById("textarea-batch-keys");
  const rawText = batchKeysTextarea?.value.trim() || "";
  if (!rawText) {
    alert("يرجى إدخال مفتاح واحد على الأقل في مربع النص.");
    return;
  }

  const keys = rawText.split(/[\s,\n]+/).map(key => key.trim()).filter(key => key.length > 0);
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
    alert("يرجى إدخال مفتاح واحد على الأقل.");
    return;
  }

  localStorage.setItem("bm_batch_keys", JSON.stringify([]));
  renderAndVerifyKeys(uniqueKeys);
}

export async function loadSavedBatchKeys() {
  let saved = localStorage.getItem("bm_batch_keys");
  if (!saved) return;

  let list = JSON.parse(saved);
  if (list.length === 0) return;

  const batchKeysTextarea = document.getElementById("textarea-batch-keys");
  if (batchKeysTextarea) batchKeysTextarea.value = list.join("\n");
  renderAndVerifyKeys(list);
}

export function loadFailedKeys() {
  const saved = localStorage.getItem("bm_failed_keys");
  failedKeys = saved ? JSON.parse(saved) : [];
  updateFailedKeysUI();
}

function addFailedKey(key) {
  if (!failedKeys.includes(key)) {
    failedKeys.push(key);
    localStorage.setItem("bm_failed_keys", JSON.stringify(failedKeys));
    updateFailedKeysUI();
  }
}

function clearFailedKeys() {
  failedKeys = [];
  localStorage.setItem("bm_failed_keys", JSON.stringify(failedKeys));
  updateFailedKeysUI();
}

function updateFailedKeysUI() {
  const container = document.getElementById("failed-keys-container");
  const textarea = document.getElementById("textarea-failed-keys");
  const countBadge = document.getElementById("failed-keys-count");

  if (!container || !textarea || !countBadge) return;

  if (failedKeys.length > 0) {
    container.style.display = "block";
    textarea.value = failedKeys.join("\n");
    countBadge.textContent = `${failedKeys.length} مفاتيح`;
  } else {
    container.style.display = "none";
    textarea.value = "";
    countBadge.textContent = "0 مفاتيح";
  }
}

function exportFailedKeys() {
  if (failedKeys.length === 0) return;
  const content = failedKeys.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "failed_api_keys.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function recheckFailedKeys() {
  if (failedKeys.length === 0) return;

  const batchKeysTextarea = document.getElementById("textarea-batch-keys");
  if (batchKeysTextarea) batchKeysTextarea.value = failedKeys.join("\n");
  clearFailedKeys();
  document.getElementById("btn-parse-batch")?.click();
}

function clearFailedKeysWithConfirm() {
  if (confirm("هل أنت متأكد من رغبتك في تفريغ سلة المفاتيح التالفة؟")) {
    clearFailedKeys();
  }
}

export function setupBatchKeyVerification({
  getActiveKey,
  activateVerifiedKey,
  saveKeyForProvider,
  beforeActivateKey
}) {
  getActiveApiKey = getActiveKey || getActiveApiKey;
  onActivateVerifiedKey = activateVerifiedKey || onActivateVerifiedKey;
  onSaveKeyForProvider = saveKeyForProvider || onSaveKeyForProvider;
  onBeforeActivateKey = beforeActivateKey || onBeforeActivateKey;

  document.getElementById("btn-parse-batch")?.addEventListener("click", parseBatchKeys);
  document.getElementById("btn-export-failed")?.addEventListener("click", exportFailedKeys);
  document.getElementById("btn-recheck-failed")?.addEventListener("click", recheckFailedKeys);
  document.getElementById("btn-clear-failed")?.addEventListener("click", clearFailedKeysWithConfirm);
}
