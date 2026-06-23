function getScreenOffsets() {
  const left = window.screenX !== undefined ? window.screenX : (window.screenLeft || 0);
  const top = window.screenY !== undefined ? window.screenY : (window.screenTop || 0);
  return { left, top };
}

function getRawCoordinates(position, screenLeft, screenTop) {
  if (!position) {
    return { x: null, y: null };
  }
  const x = position.screenX != null ? position.screenX - screenLeft : (position.x ?? null);
  const y = position.screenY != null ? position.screenY - screenTop : (position.y ?? null);
  return { x, y };
}

function getTopPosition(anchor, anchorY, menuHeight, margin) {
  const isBelow = anchor === "below";
  const preferred = isBelow ? anchorY + 10 : anchorY - menuHeight - 10;
  const fallback = isBelow ? anchorY - menuHeight - 10 : anchorY + 10;
  const limit = window.innerHeight - menuHeight - margin;
  if (preferred < margin || preferred > limit) {
    return fallback;
  }
  return preferred;
}

export function setupFloatingSelectionToolbar(refs, deps) {
  const { floatingMenu, menuStatus, quickActionDialog } = refs;
  let lastSelectedText = "";
  let selectionMenuTimer = null;
  let floatingMenuAutoHideTimer = null;
  let floatingMenuHideDeadline = 0;
  let lastSelectionTextForMenu = "";
  let suppressedSelectionTextForMenu = "";
  let suppressSelectionMenuUntil = 0;

  function placeFloatingMenu(position = null) {
    if (!floatingMenu) return;

    const menuWidth = floatingMenu.offsetWidth || 232;
    const menuHeight = floatingMenu.offsetHeight || 50;
    const margin = 12;

    const offsets = getScreenOffsets();
    const raw = getRawCoordinates(position, offsets.left, offsets.top);

    const anchor = position?.anchor || "above";
    const centerX = raw.x != null ? raw.x : Math.round(window.innerWidth / 2);
    const anchorY = raw.y != null ? raw.y : 200;

    const left = centerX - (menuWidth / 2);
    const top = getTopPosition(anchor, anchorY, menuHeight, margin);

    floatingMenu.style.left = `${Math.min(Math.max(margin, left), window.innerWidth - menuWidth - margin)}px`;
    floatingMenu.style.top = `${Math.min(Math.max(margin, top), window.innerHeight - menuHeight - margin)}px`;
  }

  function hideFloatingTextMenu({ suppressCurrentSelection = true } = {}) {
    clearTimeout(floatingMenuAutoHideTimer);
    clearTimeout(selectionMenuTimer);
    floatingMenuHideDeadline = 0;
    if (suppressCurrentSelection && lastSelectedText) {
      suppressedSelectionTextForMenu = lastSelectedText;
    }
    if (floatingMenu) floatingMenu.style.display = "none";
    lastSelectedText = "";
    lastSelectionTextForMenu = "";
  }

  function forceHideQuickTools() {
    suppressSelectionMenuUntil = Date.now() + 3000;
    hideFloatingTextMenu();
    try {
      window.getSelection?.()?.removeAllRanges();
    } catch (_) {}
    try {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT")) {
        activeElement.selectionStart = activeElement.selectionEnd;
      }
    } catch (_) {}
  }

  function scheduleFloatingMenuAutoHide() {
    clearTimeout(floatingMenuAutoHideTimer);
    floatingMenuHideDeadline = Date.now() + 5000;
    floatingMenuAutoHideTimer = setTimeout(hideFloatingTextMenu, 5000);
  }

  function showFloatingTextMenuWithText(text, position = null) {
    const cleanText = (text || "").trim();
    if (!cleanText || !floatingMenu || !menuStatus) return false;

    lastSelectedText = cleanText;
    menuStatus.textContent = cleanText.substring(0, 42) + (cleanText.length > 42 ? "..." : "");
    floatingMenu.style.display = "flex";
    placeFloatingMenu(position);
    scheduleFloatingMenuAutoHide();
    return true;
  }

  async function setSelectionMonitorEnabled(enabled) {
    if (!deps.isTauri()) return;
    try {
      await deps.invoke("set_selection_monitor_enabled", { enabled });
    } catch (err) {
      deps.addAppAlert("warning", "تعذر تحديث مراقب التحديد", err, {
        source: "الشريط السريع"
      });
    }
  }

  async function showFloatingTextMenu(options = {}) {
    const showMissingSelectionHint = () => {
      if (options.silent) return;
      if (floatingMenu && menuStatus && floatingMenu.style.display !== "none") {
        menuStatus.textContent = "حدد نصاً لاستخدام الأدوات السريعة.";
      }
    };

    try {
      if (options.text) {
        return showFloatingTextMenuWithText(options.text, options.position);
      }

      const text = await deps.invoke("copy_selected_text");
      if (!text || text.trim() === "") {
        showMissingSelectionHint();
        return false;
      }
      return showFloatingTextMenuWithText(text, options.position);
    } catch (err) {
      showMissingSelectionHint();
      return false;
    }
  }

  function isInsideMenuOrDialog(node) {
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!(el && (floatingMenu?.contains(el) || quickActionDialog?.contains(el)));
  }

  function getPageSelectionInfo() {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT")) {
      if (isInsideMenuOrDialog(activeElement)) return null;
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      if (typeof start === "number" && typeof end === "number" && end > start) {
        const text = activeElement.value.slice(start, end).trim();
        const rect = activeElement.getBoundingClientRect();
        if (text && rect) {
          return {
            text,
            position: {
              x: rect.left + (rect.width / 2),
              y: rect.top,
              anchor: "above"
            }
          };
        }
      }
    }

    const selection = window.getSelection?.();
    const text = selection?.toString().trim() || "";
    if (!text || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (container && (
      floatingMenu?.contains(container) ||
      quickActionDialog?.contains(container) ||
      container.tagName?.toLowerCase() === "select"
    )) {
      return null;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;

    return {
      text,
      position: {
        x: rect.left + (rect.width / 2),
        y: rect.top,
        anchor: "above"
      }
    };
  }

  function scheduleSelectionFloatingMenu() {
    if (!deps.isEnabled() || deps.isShortcutRecording()) return;
    if (Date.now() < suppressSelectionMenuUntil) return;
    if (quickActionDialog && !quickActionDialog.hidden) {
      if (floatingMenu) floatingMenu.style.display = "none";
      return;
    }
    const activeElement = document.activeElement;
    if (floatingMenu?.contains(activeElement)) return;
    clearTimeout(selectionMenuTimer);

    selectionMenuTimer = setTimeout(() => {
      const localSelection = getPageSelectionInfo();
      if (localSelection) {
        if (localSelection.text.length < 2) return;
        if (localSelection.text === suppressedSelectionTextForMenu) {
          return;
        }
        if (localSelection.text !== lastSelectionTextForMenu) {
          lastSelectionTextForMenu = localSelection.text;
          showFloatingTextMenuWithText(localSelection.text, localSelection.position);
        }
        return;
      }

      suppressedSelectionTextForMenu = "";
      hideFloatingTextMenu({ suppressCurrentSelection: false });
    }, 220);
  }

  document.addEventListener("mouseup", scheduleSelectionFloatingMenu);
  document.addEventListener("selectionchange", scheduleSelectionFloatingMenu);
  document.addEventListener("keyup", (event) => {
    if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      scheduleSelectionFloatingMenu();
    }
  });

  deps.listen("overlay-action", (event) => {
    const payload = event.payload || {};
    const action = typeof payload === "object" ? payload.action : null;
    const text = (typeof payload === "object" ? payload.text : "")?.trim();
    if (!action || !text) return;
    deps.openQuickAction(action, text, { useLastSelectionTarget: true });
  });

  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const text = lastSelectedText.trim();
      if (!text) {
        if (menuStatus) menuStatus.textContent = "لا يوجد نص محدد.";
        return;
      }

      deps.openQuickAction(action, text);
    });
  });

  window.addEventListener("click", (e) => {
    if (floatingMenu && !floatingMenu.contains(e.target) && e.target !== floatingMenu) {
      hideFloatingTextMenu();
    }
  });

  if (floatingMenu) {
    floatingMenu.addEventListener("mouseenter", () => {
      clearTimeout(floatingMenuAutoHideTimer);
      floatingMenuHideDeadline = 0;
    });
    floatingMenu.addEventListener("mouseleave", () => {
      scheduleFloatingMenuAutoHide();
    });
  }

  setInterval(() => {
    if (
      floatingMenu &&
      floatingMenu.style.display !== "none" &&
      floatingMenuHideDeadline > 0 &&
      Date.now() >= floatingMenuHideDeadline
    ) {
      hideFloatingTextMenu();
    }
  }, 500);

  return {
    showFloatingTextMenu,
    hideFloatingTextMenu,
    forceHideQuickTools,
    setSelectionMonitorEnabled
  };
}
