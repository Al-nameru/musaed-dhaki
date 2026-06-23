import { getErrorMessage, handleError } from "../../shared/errorHandler.js";

export { getErrorMessage };

const ALERTS_STORAGE_KEY = "bm_alerts_log";
const MAX_ALERTS_LOG = 200;

let activeAlertsFilter = "all";
let alertsLog = [];
let alertsList;
let alertsEmptyState;
let alertFilterButtons;
let alertsErrorCount;
let alertsWarningCount;
let alertsInfoCount;

export function loadAlertsLog() {
  try {
    alertsLog = JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(alertsLog)) alertsLog = [];
  } catch (e) {
    handleError(e, { silent: true, source: "alertsStore.loadAlertsLog" });
    alertsLog = [];
  }
}

function saveAlertsLog() {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alertsLog.slice(0, MAX_ALERTS_LOG)));
  } catch (e) {
    handleError(e, { silent: true, source: "alertsStore.saveAlertsLog" });
  }
}

export function addAppAlert(type, title, message = "", meta = {}) {
  const normalizedType = ["error", "warning", "success", "info"].includes(type) ? type : "info";
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: normalizedType,
    title: title || "حدث جديد",
    message: getErrorMessage(message),
    source: meta.source || "التطبيق",
    time: new Date().toISOString()
  };

  alertsLog.unshift(entry);
  alertsLog = alertsLog.slice(0, MAX_ALERTS_LOG);
  saveAlertsLog();
  renderAlertsPanel();
  showToastNotification(normalizedType, entry.title, entry.message);
  if (typeof window !== "undefined" && window.onAppAlertAdded) {
    window.onAppAlertAdded();
  }
}

function showToastNotification(type, title, message) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-item ${type}`;

  const icon = document.createElement("div");
  icon.className = "toast-icon";
  icon.textContent = getAlertIcon(type);

  const content = document.createElement("div");
  content.className = "toast-content";

  const titleEl = document.createElement("strong");
  titleEl.className = "toast-title";
  titleEl.textContent = title;
  content.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement("span");
    msgEl.className = "toast-message";
    msgEl.textContent = message;
    content.appendChild(msgEl);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.innerHTML = "×";
  closeBtn.type = "button";
  closeBtn.ariaLabel = "إغلاق التنبيه";
  closeBtn.addEventListener("click", () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  });

  toast.appendChild(icon);
  toast.appendChild(content);
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove("show");
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

function getAlertIcon(type) {
  if (type === "error") return "⛔";
  if (type === "warning") return "⚠️";
  if (type === "success") return "✅";
  return "ℹ️";
}

function formatAlertTime(isoTime) {
  try {
    return new Intl.DateTimeFormat("ar", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(isoTime));
  } catch (e) {
    handleError(e, { silent: true, source: "alertsStore.formatAlertTime" });
    return isoTime;
  }
}

export function renderAlertsPanel() {
  if (!alertsList || !alertsEmptyState) return;

  const filtered = activeAlertsFilter === "all"
    ? alertsLog
    : alertsLog.filter(entry => (
      activeAlertsFilter === "info"
        ? entry.type === "info" || entry.type === "success"
        : entry.type === activeAlertsFilter
    ));

  alertsList.innerHTML = "";
  alertsEmptyState.style.display = filtered.length ? "none" : "block";

  filtered.forEach(entry => {
    const item = document.createElement("article");
    item.className = `alert-log-item ${entry.type}`;

    const icon = document.createElement("div");
    icon.className = "alert-log-icon";
    icon.textContent = getAlertIcon(entry.type);

    const body = document.createElement("div");
    body.className = "alert-log-body";

    const header = document.createElement("div");
    header.className = "alert-log-header";

    const title = document.createElement("strong");
    title.textContent = entry.title;

    const time = document.createElement("span");
    time.textContent = formatAlertTime(entry.time);

    header.appendChild(title);
    header.appendChild(time);

    const message = document.createElement("p");
    message.textContent = entry.message || entry.source || "";

    const source = document.createElement("small");
    source.textContent = entry.source;

    body.appendChild(header);
    if (message.textContent) body.appendChild(message);
    body.appendChild(source);
    item.appendChild(icon);
    item.appendChild(body);
    alertsList.appendChild(item);
  });

  const counts = alertsLog.reduce((acc, entry) => {
    if (entry.type === "error") acc.error += 1;
    else if (entry.type === "warning") acc.warning += 1;
    else acc.info += 1;
    return acc;
  }, { error: 0, warning: 0, info: 0 });

  if (alertsErrorCount) alertsErrorCount.textContent = counts.error.toString();
  if (alertsWarningCount) alertsWarningCount.textContent = counts.warning.toString();
  if (alertsInfoCount) alertsInfoCount.textContent = counts.info.toString();
}

export function initAlertsPanel({
  list,
  emptyState,
  clearButton,
  filterButtons,
  errorCount,
  warningCount,
  infoCount
}) {
  alertsList = list;
  alertsEmptyState = emptyState;
  alertFilterButtons = filterButtons;
  alertsErrorCount = errorCount;
  alertsWarningCount = warningCount;
  alertsInfoCount = infoCount;

  clearButton?.addEventListener("click", () => {
    clearAlertsLog();
  });

  alertFilterButtons?.forEach(button => {
    button.addEventListener("click", () => {
      activeAlertsFilter = button.dataset.alertFilter || "all";
      alertFilterButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAlertsPanel();
    });
  });

  renderAlertsPanel();
}

export function getAlertsLog() {
  return alertsLog;
}

export function clearAlertsLog() {
  alertsLog = [];
  saveAlertsLog();
  renderAlertsPanel();
  if (typeof window !== "undefined" && window.onAppAlertAdded) {
    window.onAppAlertAdded();
  }
}

export function setupGlobalAlertHandlers() {
  window.addEventListener("error", (event) => {
    addAppAlert("error", "خطأ JavaScript", event.message || "حدث خطأ غير معروف", {
      source: event.filename ? `${event.filename}:${event.lineno || 0}` : "window.error"
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    addAppAlert("error", "وعد مرفوض غير معالج", getErrorMessage(event.reason), {
      source: "unhandledrejection"
    });
  });
}
