function getCompareColsSetting() {
  return localStorage.getItem("bm_compare_cols") || "auto";
}

function getCompareViewMode() {
  return localStorage.getItem("bm_compare_view_mode") || "cards";
}

function getCompareColumnLabel(card) {
  const provider = card.querySelector(".compare-provider-select")?.value || "";
  const model = card.querySelector(".compare-model-select")?.value || "";
  const fallback = card.querySelector(".mc-provider-name")?.textContent || "عمود مخفي";
  return [provider, model].filter(Boolean).join(" / ") || fallback;
}

export function renderHiddenCompareColumnsMenu(container, onStatus = () => {}) {
  const menu = document.getElementById("hidden-columns-menu");
  const button = document.getElementById("btn-show-hidden-columns");
  const list = document.getElementById("hidden-columns-list");
  if (!container || !menu || !button || !list) return;

  const hiddenCards = [...container.querySelectorAll(".model-compare-column.is-hidden")];
  menu.hidden = hiddenCards.length === 0;
  button.textContent = `👁️ المخفية${hiddenCards.length ? ` (${hiddenCards.length})` : ""}`;
  if (!hiddenCards.length) {
    list.hidden = true;
    list.replaceChildren();
    button.setAttribute("aria-expanded", "false");
    return;
  }

  list.replaceChildren();
  hiddenCards.forEach((card) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mc-hidden-column-item";
    item.textContent = getCompareColumnLabel(card);
    item.addEventListener("click", () => {
      card.classList.remove("is-hidden");
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      applyCompareLayout(container, onStatus);
      onStatus("تم إظهار العمود المحدد.");
    });
    list.appendChild(item);
  });
}

export function applyCompareLayout(container, onStatus = () => {}) {
  if (!container) return;
  const value = getCompareColsSetting();
  const viewMode = getCompareViewMode();
  const visibleCount = container.querySelectorAll(".model-compare-column:not(.is-hidden)").length || 1;
  renderHiddenCompareColumnsMenu(container, onStatus);
  container.classList.toggle("is-table-view", viewMode === "table");
  if (value === "auto") {
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
    container.classList.remove("is-fixed-cols");
    return;
  }
  const columns = Math.max(1, parseInt(value, 10) || 1);
  const tracks = Math.min(columns, visibleCount);
  container.style.gridTemplateColumns = `repeat(${tracks}, minmax(300px, 1fr))`;
  container.classList.add("is-fixed-cols");
}

export function setupCompareLayoutControls(container, onStatus = () => {}) {
  const hiddenButton = document.getElementById("btn-show-hidden-columns");
  hiddenButton?.addEventListener("click", () => {
    const list = document.getElementById("hidden-columns-list");
    if (!list || !hiddenButton) return;
    renderHiddenCompareColumnsMenu(container, onStatus);
    list.hidden = !list.hidden;
    hiddenButton.setAttribute("aria-expanded", String(!list.hidden));
  });

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("hidden-columns-menu");
    const button = document.getElementById("btn-show-hidden-columns");
    const list = document.getElementById("hidden-columns-list");
    if (!menu || !button || !list || list.hidden) return;
    if (!menu.contains(event.target)) {
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });

  const colsSelect = document.getElementById("mc-cols-select");
  if (colsSelect) {
    colsSelect.value = getCompareColsSetting();
    colsSelect.addEventListener("change", () => {
      localStorage.setItem("bm_compare_cols", colsSelect.value);
      applyCompareLayout(container, onStatus);
    });
  }

  const viewSelect = document.getElementById("mc-view-select");
  if (viewSelect) {
    viewSelect.value = getCompareViewMode();
    viewSelect.addEventListener("change", () => {
      localStorage.setItem("bm_compare_view_mode", viewSelect.value);
      applyCompareLayout(container, onStatus);
    });
  }

  applyCompareLayout(container, onStatus);
}
