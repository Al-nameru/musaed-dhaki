import { addAppAlert } from "../modules/alerts/api.js";
import { invoke } from "./tauriClient.js";

let highlightEl = null;
let tooltipEl = null;
let active = false;
let screenshotMode = false;

function getCssSelector(el) {
  if (el.id) {
    return `#${el.id}`;
  }
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    const className = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
    if (className) {
      const classes = className.split(/\s+/).filter(c => c && !c.startsWith("element-picker"));
      if (classes.length > 0) {
        selector += "." + classes.join(".");
      }
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}

function injectStyles() {
  if (document.getElementById("element-picker-styles")) return;
  const style = document.createElement("style");
  style.id = "element-picker-styles";
  style.textContent = `
    .element-picker-highlight {
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      border: 2px solid var(--accent, #6c5ce7);
      background-color: rgba(108, 92, 231, 0.15);
      box-shadow: 0 0 10px rgba(108, 92, 231, 0.4);
      border-radius: 4px;
      transition: all 0.05s ease-out;
    }
    .element-picker-highlight.screenshot-pending {
      border-color: #ff7675 !important;
      background-color: rgba(255, 118, 117, 0.25) !important;
      box-shadow: 0 0 15px rgba(255, 118, 117, 0.6) !important;
    }
    .element-picker-tooltip {
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      background-color: #1e1e24;
      color: #00cec9;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: Consolas, monospace;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      border: 1px solid var(--accent, #6c5ce7);
    }
  `;
  document.head.appendChild(style);
}

export const elementPicker = {
  start(onSelectCallback = null, isScreenshotMode = false) {
    if (active) return;
    active = true;
    this.onSelect = onSelectCallback;
    screenshotMode = isScreenshotMode;
    injectStyles();

    highlightEl = document.createElement("div");
    highlightEl.className = "element-picker-highlight" + (screenshotMode ? " screenshot-pending" : "");
    document.body.appendChild(highlightEl);

    tooltipEl = document.createElement("div");
    tooltipEl.className = "element-picker-tooltip";
    document.body.appendChild(tooltipEl);

    document.addEventListener("mousemove", this.handleMouseMove, true);
    document.addEventListener("click", this.handleClick, true);
    document.addEventListener("keydown", this.handleKeyDown, true);

    addAppAlert("info", 
      screenshotMode ? "تم تفعيل وضع لقطة الشاشة" : "تم تفعيل فحص العناصر", 
      screenshotMode ? "حرك الماوس لتظليل أي عنصر، وانقر عليه لأخذ لقطة شاشة وإرسالها للمساعد الذكي. اضغط Esc للإلغاء." : "حرك الماوس لتظليل أي عنصر، وانقر لتحديده. اضغط Esc للإلغاء.", 
      { source: "المفتش البصري" }
    );
  },

  stop() {
    if (!active) return;
    active = false;
    this.onSelect = null;
    screenshotMode = false;

    if (highlightEl) {
      highlightEl.remove();
      highlightEl = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }

    document.removeEventListener("mousemove", this.handleMouseMove, true);
    document.removeEventListener("click", this.handleClick, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
  },

  handleMouseMove(e) {
    if (!active) return;
    const el = e.target;
    if (el === highlightEl || el === tooltipEl || el === document.body || el === document.html) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    if (highlightEl) {
      highlightEl.style.width = `${rect.width}px`;
      highlightEl.style.height = `${rect.height}px`;
      highlightEl.style.top = `${rect.top + scrollTop}px`;
      highlightEl.style.left = `${rect.left + scrollLeft}px`;
    }

    if (tooltipEl) {
      let tagName = el.tagName.toLowerCase();
      let idStr = el.id ? `#${el.id}` : "";
      const className = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
      let classStr = (className && el.classList) ? `.${Array.from(el.classList).filter(c => !c.startsWith("element-picker")).join(".")}` : "";
      if (classStr === ".") classStr = "";
      
      tooltipEl.textContent = `${tagName}${idStr}${classStr}`;
      
      // Position tooltip above the element, or below if there is no space
      let tooltipTop = rect.top + scrollTop - 30;
      if (tooltipTop < scrollTop + 5) {
        tooltipTop = rect.bottom + scrollTop + 5;
      }
      tooltipEl.style.top = `${tooltipTop}px`;
      tooltipEl.style.left = `${rect.left + scrollLeft}px`;
    }
  },

  handleClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    if (screenshotMode) {
      elementPicker.handleDoubleClick(el);
    } else {
      elementPicker.handleSingleClick(el);
    }
  },

  handleSingleClick(el) {
    const selector = getCssSelector(el);
    const text = el.textContent?.trim() || "";
    const tagName = el.tagName.toLowerCase();
    const classes = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
    const id = el.id || "";

    if (elementPicker.onSelect) {
      elementPicker.onSelect(selector);
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(selector).then(() => {
        addAppAlert("success", "تم التقاط العنصر", `تم نسخ معرّف العنصر: ${selector} إلى الحافظة.`, {
          source: "المفتش البصري"
        });
      }).catch(err => {
        console.error("Failed to copy selector:", err);
      });
    }

    // Also send to backend to record it for AI inspection
    invoke("save_inspected_element", {
      selector,
      text,
      tagName,
      classes,
      id
    }).then(() => {
      addAppAlert("success", "تم إرسال العنصر بنجاح", `تم تسجيل وإرسال العنصر: ${selector} إلى المساعد الذكي بنجاح ✅`, {
        source: "المفتش البصري"
      });
    }).catch(err => {
      console.error("Failed to save inspected element:", err);
    });

    elementPicker.stop();
  },

  handleDoubleClick(el) {
    const timestamp = Date.now();
    const artifactPath = `C:/Users/Nutzer/.gemini/antigravity-ide/brain/51a60f7d-457f-4a56-a54a-e30792faa3bc/media__${timestamp}.png`;

    invoke("take_screenshot", { savePath: artifactPath })
      .then(() => {
        addAppAlert("success", "تم التقاط الشاشة بنجاح", `تم التقاط لقطة شاشة وحفظها كـ media__${timestamp}.png في مجلد الـ artifacts الخاص بك 📸`, {
          source: "المفتش البصري"
        });
      })
      .catch(err => {
        console.error("Failed to take screenshot:", err);
        addAppAlert("error", "فشل التقاط الشاشة", `حدث خطأ أثناء أخذ لقطة الشاشة: ${err}`, {
          source: "المفتش البصري"
        });
      });

    elementPicker.stop();
  },

  handleKeyDown(e) {
    if (!active) return;
    if (e.key === "Escape" || e.key === "Esc") {
      elementPicker.stop();
      addAppAlert("info", "تم إلغاء فحص العناصر", "تم إغلاق المفتش البصري دون تحديد أي عنصر.", {
        source: "المفتش البصري"
      });
    }
  }
};
