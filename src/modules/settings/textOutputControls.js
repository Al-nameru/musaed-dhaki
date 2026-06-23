import { appState } from "../../shared/appState.js";

export function setupTextOutputControls(refs, deps) {
  const {
    chkAppendMode,
    chkSelectionFloatingMenu,
    selectOutputTarget,
    chkLiveTranscription,
    selectTextInsertionMode
  } = refs;

  if (selectTextInsertionMode) {
    const isCustomDropdown = selectTextInsertionMode.classList.contains("custom-dropdown");

    const syncLegacyAppendSettings = (modeValue) => {
      if (modeValue === "replace" || modeValue === "insert-cursor") {
        appState.set("appendMode", false);
      } else if (modeValue === "append-newline") {
        appState.set("appendMode", true);
        appState.set("appendSeparator", "newline");
      } else if (modeValue === "append-space") {
        appState.set("appendMode", true);
        appState.set("appendSeparator", "space");
      }
    };

    if (isCustomDropdown) {
      const trigger = selectTextInsertionMode.querySelector(".dropdown-trigger");
      const triggerValueEl = selectTextInsertionMode.querySelector(".trigger-value");
      const menu = selectTextInsertionMode.querySelector(".dropdown-menu");
      const items = selectTextInsertionMode.querySelectorAll(".dropdown-item");

      const updateDropdownState = (modeValue) => {
        items.forEach((item) => {
          if (item.getAttribute("data-value") === modeValue) {
            item.classList.add("active");
            if (triggerValueEl) {
              triggerValueEl.textContent = item.textContent;
            }
          } else {
            item.classList.remove("active");
          }
        });
        syncLegacyAppendSettings(modeValue);
      };

      // Toggle dropdown open/close
      trigger?.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = selectTextInsertionMode.classList.contains("is-open");
        if (isOpen) {
          selectTextInsertionMode.classList.remove("is-open");
          if (menu) menu.hidden = true;
        } else {
          selectTextInsertionMode.classList.add("is-open");
          if (menu) menu.hidden = false;
        }
      });

      // Item click handling
      items.forEach((item) => {
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          const modeValue = item.getAttribute("data-value");
          appState.set("textInsertionMode", modeValue);
          // Close the dropdown
          selectTextInsertionMode.classList.remove("is-open");
          if (menu) menu.hidden = true;
        });
      });

      // Click outside to close
      document.addEventListener("click", (event) => {
        if (!selectTextInsertionMode.contains(event.target)) {
          selectTextInsertionMode.classList.remove("is-open");
          if (menu) menu.hidden = true;
        }
      });

      // Subscribe to appState to keep UI synchronized
      appState.textInsertionMode.subscribe((value) => {
        updateDropdownState(value || "replace");
      });

    } else {
      selectTextInsertionMode.value = appState.get("textInsertionMode") || "replace";
      syncLegacyAppendSettings(selectTextInsertionMode.value);

      selectTextInsertionMode.addEventListener("change", (event) => {
        const mode = event.target.value;
        appState.set("textInsertionMode", mode);
        syncLegacyAppendSettings(mode);
      });
    }
  }

  const selectAppendSeparator = document.getElementById("select-append-separator");

  if (chkAppendMode) {
    const updateSeparatorVisibility = () => {
      if (selectAppendSeparator) {
        selectAppendSeparator.style.display = chkAppendMode.checked ? "inline-block" : "none";
      }
    };

    chkAppendMode.checked = appState.get("appendMode");
    updateSeparatorVisibility();

    chkAppendMode.addEventListener("change", (event) => {
      deps.setAppendMode(event.target.checked);
      updateSeparatorVisibility();
      const separator = selectAppendSeparator ? selectAppendSeparator.value : "newline";
      const insertionMode = event.target.checked
        ? (separator === "space" ? "append-space" : "append-newline")
        : "replace";
      appState.set("textInsertionMode", insertionMode);
    });
  }

  if (selectAppendSeparator) {
    selectAppendSeparator.value = deps.getAppendSeparator ? deps.getAppendSeparator() : "newline";
    selectAppendSeparator.addEventListener("change", (event) => {
      if (deps.setAppendSeparator) deps.setAppendSeparator(event.target.value);
      if (appState.get("appendMode")) {
        appState.set("textInsertionMode", event.target.value === "space" ? "append-space" : "append-newline");
      }
    });
  }

  if (chkSelectionFloatingMenu) {
    chkSelectionFloatingMenu.checked = appState.get("selectionFloatingMenuEnabled");
    deps.setSelectionMonitorEnabled(chkSelectionFloatingMenu.checked);
    chkSelectionFloatingMenu.addEventListener("change", (event) => {
      const val = event.target.checked;
      appState.set("selectionFloatingMenuEnabled", val);
      deps.setSelectionMonitorEnabled(val);
      if (!val) {
        deps.forceHideQuickTools();
      }
    });
  }

  if (selectOutputTarget) {
    let target = appState.get("textOutputTarget");
    if (!["both", "external", "app"].includes(target)) {
      target = "both";
      appState.set("textOutputTarget", target);
    }
    selectOutputTarget.value = target;
    selectOutputTarget.addEventListener("change", (event) => {
      appState.set("textOutputTarget", event.target.value);
    });
  }

  if (chkLiveTranscription) {
    chkLiveTranscription.checked = appState.get("liveTranscriptionEnabled");
    chkLiveTranscription.addEventListener("change", (event) => {
      appState.set("liveTranscriptionEnabled", event.target.checked);
    });
  }
}
