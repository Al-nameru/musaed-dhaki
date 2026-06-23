import tabHome from "./partialsContent/tabHome.js";
import tabKeys from "./partialsContent/tabKeys.js";
import tabSettings from "./partialsContent/tabSettings.js";
import tabAlerts from "./partialsContent/tabAlerts.js";
import tabStats from "./partialsContent/tabStats.js";
import quickTools from "./partialsContent/quickTools.js";

const partials = {
  "partials/tab-home.html": tabHome,
  "partials/tab-keys.html": tabKeys,
  "partials/tab-compare.html": () => import("./partialsContent/tabCompare.js").then((m) => m.default),
  "partials/tab-settings.html": tabSettings,
  "partials/tab-alerts.html": tabAlerts,
  "partials/tab-stats.html": tabStats,
  "partials/quick-tools.html": quickTools
};

async function loadPartial(target) {
  const src = target.dataset.partial;
  let html = partials[src];
  if (!html) throw new Error(`Missing bundled partial: ${src}`);
  if (typeof html === "function") {
    html = await html();
  }
  target.outerHTML = html;
}

window.smartAssistantPartials = {
  loadDemand: async (tabId) => {
    const src = `partials/${tabId}.html`;
    const el = document.querySelector(`[data-partial="${src}"]`);
    if (el) {
      await loadPartial(el);
    }
  }
};

window.smartAssistantPartialsReady = Promise.resolve().then(async () => {
  const elements = Array.from(document.querySelectorAll("[data-partial]"));
  for (const el of elements) {
    const src = el.dataset.partial;
    if (src === "partials/tab-compare.html") {
      continue;
    }
    await loadPartial(el);
  }
  document.documentElement.dataset.partialsReady = "true";
}).catch((err) => {
  console.error("Partial loading failed:", err);
  document.body?.insertAdjacentHTML(
    "afterbegin",
    '<div style="padding:12px;background:#3f1d1d;color:#ffd6d6;font:14px system-ui">تعذر تحميل أجزاء الواجهة. راجع وحدة التحكم للتفاصيل.</div>'
  );
  throw err;
});

