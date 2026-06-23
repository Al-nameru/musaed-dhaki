import { getAlertsLog, clearAlertsLog, addAppAlert } from "../modules/alerts/store.js";

const consoleErrors = [];
const maxConsoleErrors = 150;

// Intercept console.error immediately upon import
const originalConsoleError = console.error;
console.error = function (...args) {
  originalConsoleError.apply(console, args);
  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.stack || arg.message || String(arg);
    if (typeof arg === "object") {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(" ");

  consoleErrors.push({
    time: new Date().toISOString(),
    message: msg
  });

  if (consoleErrors.length > maxConsoleErrors) {
    consoleErrors.shift();
  }

  if (typeof window !== "undefined" && window.updateErrorInspectorUI) {
    window.updateErrorInspectorUI();
  }
};

export const errorInspector = {
  init() {
    // Setup callbacks
    window.onAppAlertAdded = () => {
      this.render();
    };
    window.updateErrorInspectorUI = () => {
      this.render();
    };

    // DOM Wiring
    const btnOpen = document.getElementById("btn-open-error-inspector");
    const modal = document.getElementById("error-inspector-modal");
    const btnClose = document.getElementById("btn-close-error-inspector");
    const backdrop = modal?.querySelector(".error-inspector-backdrop");
    const tabs = modal?.querySelectorAll(".inspector-tab");
    
    const btnCopyApp = document.getElementById("btn-copy-app-errors");
    const btnClearApp = document.getElementById("btn-clear-app-errors");
    const btnCopyConsole = document.getElementById("btn-copy-console-errors");
    const btnClearConsole = document.getElementById("btn-clear-console-errors");

    // Open/Close
    btnOpen?.addEventListener("click", () => {
      modal?.classList.add("is-open");
      this.render();
    });

    const closeModal = () => {
      modal?.classList.remove("is-open");
    };

    btnClose?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", closeModal);

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("is-open")) {
        closeModal();
      }
    });

    // Tab Switching
    tabs?.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        const targetTab = tab.dataset.tab;
        if (modal) {
          modal.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
          });
          
          const contentEl = document.getElementById(`tab-content-${targetTab}`);
          if (contentEl) contentEl.classList.add("active");
        }
      });
    });

    // Copying
    btnCopyApp?.addEventListener("click", () => {
      const logs = getAlertsLog();
      if (logs.length === 0) {
        addAppAlert("info", "نسخ السجلات", "لا توجد أخطاء للتطبيق لنسخها.", { source: "مفتش الأخطاء" });
        return;
      }
      const formatted = logs.map(entry => {
        return `[${entry.time}] [${entry.type.toUpperCase()}] [${entry.source}] ${entry.title}: ${entry.message}`;
      }).join("\n");

      navigator.clipboard.writeText(formatted).then(() => {
        addAppAlert("success", "نسخ السجلات", "تم نسخ أخطاء التطبيق إلى الحافظة بنجاح ✅", { source: "مفتش الأخطاء" });
      }).catch(err => {
        console.error("Failed to copy app errors:", err);
      });
    });

    btnCopyConsole?.addEventListener("click", () => {
      if (consoleErrors.length === 0) {
        addAppAlert("info", "نسخ السجلات", "لا توجد سجلات كونسول لنسخها.", { source: "مفتش الأخطاء" });
        return;
      }
      const formatted = consoleErrors.map(entry => {
        return `[${entry.time}] ${entry.message}`;
      }).join("\n");

      navigator.clipboard.writeText(formatted).then(() => {
        addAppAlert("success", "نسخ السجلات", "تم نسخ سجلات الكونسول إلى الحافظة بنجاح ✅", { source: "مفتش الأخطاء" });
      }).catch(err => {
        console.error("Failed to copy console errors:", err);
      });
    });

    // Clearing
    btnClearApp?.addEventListener("click", () => {
      clearAlertsLog();
      addAppAlert("info", "تطهير السجل", "تم مسح سجل تنبيهات وأخطاء التطبيق.", { source: "مفتش الأخطاء" });
    });

    btnClearConsole?.addEventListener("click", () => {
      consoleErrors.length = 0;
      this.render();
      addAppAlert("info", "تطهير السجل", "تم مسح سجل أخطاء الكونسول.", { source: "مفتش الأخطاء" });
    });

    // Initial render for counters
    this.render();
  },

  getConsoleErrors() {
    return consoleErrors;
  },

  render() {
    const modal = document.getElementById("error-inspector-modal");
    if (!modal) return;

    const appList = document.getElementById("app-errors-list");
    const consoleList = document.getElementById("console-errors-list");
    const appCount = document.getElementById("app-errors-count");
    const consoleCount = document.getElementById("console-errors-count");

    const appLogs = getAlertsLog();

    // Update counters
    if (appCount) appCount.textContent = appLogs.length.toString();
    if (consoleCount) consoleCount.textContent = consoleErrors.length.toString();

    // Render App Errors
    if (appList) {
      if (appLogs.length === 0) {
        appList.innerHTML = '<div class="empty-state">لا توجد أخطاء مسجلة للتطبيق حالياً.</div>';
      } else {
        appList.innerHTML = "";
        appLogs.forEach(entry => {
          const card = document.createElement("div");
          card.className = `error-card ${entry.type}`;

          const meta = document.createElement("div");
          meta.className = "error-card-meta";

          const title = document.createElement("span");
          title.className = "error-card-title";
          title.textContent = `[${entry.type.toUpperCase()}] ${entry.title}`;

          const time = document.createElement("span");
          time.textContent = new Date(entry.time).toLocaleTimeString("ar");

          meta.appendChild(title);
          meta.appendChild(time);

          const msg = document.createElement("div");
          msg.className = "error-card-message";
          msg.textContent = `${entry.message}\nSource: ${entry.source}`;

          card.appendChild(meta);
          card.appendChild(msg);
          appList.appendChild(card);
        });
      }
    }

    // Render Console Errors
    if (consoleList) {
      if (consoleErrors.length === 0) {
        consoleList.innerHTML = '<div class="empty-state">لا توجد سجلات أخطاء كونسول حالياً.</div>';
      } else {
        consoleList.innerHTML = "";
        consoleErrors.forEach(entry => {
          const card = document.createElement("div");
          card.className = "error-card error";

          const meta = document.createElement("div");
          meta.className = "error-card-meta";

          const title = document.createElement("span");
          title.className = "error-card-title";
          title.textContent = "[CONSOLE ERROR]";

          const time = document.createElement("span");
          time.textContent = new Date(entry.time).toLocaleTimeString("ar");

          meta.appendChild(title);
          meta.appendChild(time);

          const msg = document.createElement("div");
          msg.className = "error-card-message";
          msg.textContent = entry.message;

          card.appendChild(meta);
          card.appendChild(msg);
          consoleList.appendChild(card);
        });
      }
    }
  }
};
