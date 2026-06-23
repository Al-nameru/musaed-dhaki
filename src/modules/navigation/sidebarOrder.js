const SIDEBAR_TAB_ORDER_KEY = "bm_sidebar_tab_order";

export function restoreSidebarTabOrder() {
  const navMenu = document.querySelector(".nav-menu");
  if (!navMenu) return;

  let order = [];
  try {
    order = JSON.parse(localStorage.getItem(SIDEBAR_TAB_ORDER_KEY) || "[]");
  } catch (e) {
    order = [];
  }
  if (!Array.isArray(order) || !order.length) return;

  const items = [...navMenu.querySelectorAll(".nav-item")];
  const byTab = new Map(items.map(item => [item.dataset.tab, item]));
  order.forEach(tabId => {
    const item = byTab.get(tabId);
    if (item) navMenu.appendChild(item);
  });
  items.forEach(item => {
    if (!order.includes(item.dataset.tab)) navMenu.appendChild(item);
  });
}

function saveSidebarTabOrder() {
  const order = [...document.querySelectorAll(".nav-menu .nav-item")]
    .map(item => item.dataset.tab)
    .filter(Boolean);
  localStorage.setItem(SIDEBAR_TAB_ORDER_KEY, JSON.stringify(order));
}

function getSidebarDragAfterElement(container, y) {
  const candidates = [...container.querySelectorAll(".nav-item:not(.dragging)")];
  return candidates.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

export function setupSidebarTabDragAndDrop({ onReordered = () => {} } = {}) {
  const navMenu = document.querySelector(".nav-menu");
  if (!navMenu || navMenu.dataset.dragReady === "true") return;
  navMenu.dataset.dragReady = "true";
  let pointerDrag = null;

  const movePointerDrag = (event) => {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;

    const verticalMove = Math.abs(event.clientY - pointerDrag.startY);
    if (!pointerDrag.moved && verticalMove < 5) return;

    pointerDrag.moved = true;
    pointerDrag.item.classList.add("dragging");
    event.preventDefault();

    const afterElement = getSidebarDragAfterElement(navMenu, event.clientY);
    if (afterElement) navMenu.insertBefore(pointerDrag.item, afterElement);
    else navMenu.appendChild(pointerDrag.item);
  };

  const finishPointerDrag = (event) => {
    if (!pointerDrag) return;

    const { item, pointerId, moved } = pointerDrag;
    if (event?.pointerId !== undefined && event.pointerId !== pointerId) return;

    document.removeEventListener("pointermove", movePointerDrag, true);
    document.removeEventListener("pointerup", finishPointerDrag, true);
    document.removeEventListener("pointercancel", finishPointerDrag, true);

    try {
      item.releasePointerCapture?.(pointerId);
    } catch (_) {
      // Some WebView builds release capture automatically.
    }

    item.classList.remove("dragging");
    if (moved) {
      onReordered();
      saveSidebarTabOrder();
    }
    pointerDrag = null;
  };

  navMenu.querySelectorAll(".nav-item").forEach(item => {
    item.draggable = false;
    item.classList.add("is-reorderable");
    item.title = item.title || "اسحب لإعادة ترتيب التبويبات";

    item.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerDrag) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, select, textarea, a")) return;

      // حصر السحب والترتيب فقط عند الضغط على مقبض السحب المخصص
      if (!target?.closest(".drag-handle")) return;

      pointerDrag = {
        item,
        pointerId: event.pointerId,
        startY: event.clientY,
        moved: false
      };
      try {
        item.setPointerCapture?.(event.pointerId);
      } catch (_) {
        // Global listeners below keep dragging alive when capture is unavailable.
      }
      document.addEventListener("pointermove", movePointerDrag, true);
      document.addEventListener("pointerup", finishPointerDrag, true);
      document.addEventListener("pointercancel", finishPointerDrag, true);
    }, { passive: true });
  });
}
