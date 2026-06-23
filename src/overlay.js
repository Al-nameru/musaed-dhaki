// Floating selection toolbar — runs inside the transparent, non-activating
// `overlay` window. It never holds focus; it only forwards the chosen action
// (with the captured text) back to the main app via Tauri commands.

import { invoke, listen } from "./shared/tauriClient.js";

const bar = document.getElementById("bar");
const notificationPill = document.getElementById("notification-pill");
const notificationIcon = document.getElementById("notification-icon");
const notificationText = document.getElementById("notification-text");

let currentText = "";
let autoHideTimer = null;
let autoHideDeadline = 0;

function scheduleAutoHide() {
  clearTimeout(autoHideTimer);
  autoHideDeadline = Date.now() + 5000;
  autoHideTimer = setTimeout(() => {
    if (invoke) {
      invoke("hide_selection_overlay").catch(() => {});
    }
  }, 5000);
}

if (bar) {
  bar.addEventListener("mouseenter", () => {
    clearTimeout(autoHideTimer);
    autoHideDeadline = 0;
  });
  bar.addEventListener("mouseleave", () => {
    scheduleAutoHide();
  });
}

setInterval(() => {
  if (autoHideDeadline > 0 && Date.now() >= autoHideDeadline && invoke) {
    autoHideDeadline = 0;
    currentText = "";
    clearTimeout(autoHideTimer);
    invoke("hide_selection_overlay").catch(() => {});
  }
}, 500);

// Replay the entrance animation each time the overlay is shown for a new selection.
function replayEntrance() {
  if (!bar) return;
  bar.classList.remove("show");
  // Force reflow so the animation restarts.
  void bar.offsetWidth;
  bar.classList.add("show");
}

if (listen) {
  listen("selection-overlay-show", (event) => {
    currentText = typeof event.payload === "string" ? event.payload : (event.payload?.text || "");
    if (notificationPill) notificationPill.style.display = "none";
    if (bar) bar.style.display = "flex";
    replayEntrance();
    scheduleAutoHide();
  });

  listen("show-status-notification", (event) => {
    const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
    if (bar) bar.style.display = "none";
    if (notificationPill) {
      notificationPill.style.display = "flex";
      if (notificationIcon && payload.icon) {
        notificationIcon.textContent = payload.icon;
      }
      if (notificationText && payload.text) {
        notificationText.textContent = payload.text;
      }
      notificationPill.classList.remove("show");
      void notificationPill.offsetWidth;
      notificationPill.classList.add("show");
    }
    scheduleAutoHide();
  });
}

document.querySelectorAll(".act").forEach((button) => {
  button.addEventListener("click", async () => {
    clearTimeout(autoHideTimer);
    autoHideDeadline = 0;
    const action = button.dataset.action;
    if (!action || !currentText || !invoke) return;
    try {
      await invoke("run_overlay_action", { action, text: currentText });
    } catch (_err) {
      // The overlay must never crash the capture loop; failures are non-fatal.
    }
  });
});

// Esc dismisses the overlay without choosing an action.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && invoke) {
    clearTimeout(autoHideTimer);
    autoHideDeadline = 0;
    invoke("hide_selection_overlay").catch(() => {});
  }
});
