export function createNavigationTabs(deps) {
  let navItems = [];
  let ignoreNavClickUntil = 0;

  const scrollPositions = {};

  let isLoadingTab = false;

  const activateNavTab = async (item) => {
    if (!item || isLoadingTab) return;
    isLoadingTab = true;

    try {
      // Save current active tab scroll position
      const currentPane = document.querySelector(".tab-pane.active");
      if (currentPane) {
        scrollPositions[currentPane.id] = currentPane.scrollTop;
      }

      const targetTab = item.dataset.tab;

      // Lazy load the tab content if it's still a placeholder
      const placeholder = document.querySelector(`[data-partial="partials/${targetTab}.html"]`);
      if (placeholder) {
        if (window.smartAssistantPartials && window.smartAssistantPartials.loadDemand) {
          await window.smartAssistantPartials.loadDemand(targetTab);
        }
      }

      const targetPane = document.getElementById(targetTab);
      if (!targetPane) return;

      navItems.forEach((nav) => nav.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

      item.classList.add("active");
      targetPane.classList.add("active");

      // Restore saved scroll position
      if (scrollPositions[targetTab] !== undefined) {
        targetPane.scrollTop = scrollPositions[targetTab];
      }

      if (deps.abortModelComparison) {
        deps.abortModelComparison();
      }

      if (targetTab === "tab-stats") {
        deps.loadTokenStats();
      }
      if (targetTab === "tab-alerts") {
        deps.renderAlertsPanel();
      }
      if (targetTab === "tab-compare") {
        deps.setupModelComparison();
        deps.refreshModelComparisonOptions();
      }
    } catch (e) {
      console.error("Error activating nav tab:", e);
    } finally {
      isLoadingTab = false;
    }
  };

  const setupTabs = () => {
    deps.restoreSidebarTabOrder();
    navItems = [...document.querySelectorAll(".nav-item")];
    deps.setupSidebarTabDragAndDrop({
      onReordered: () => {
        ignoreNavClickUntil = Date.now() + 180;
      }
    });
    navItems.forEach((item) => {
      item.addEventListener("click", (event) => {
        if (Date.now() < ignoreNavClickUntil) {
          event.preventDefault();
          return;
        }
        activateNavTab(item);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const keyNum = parseInt(event.key, 10);
        if (keyNum >= 1 && keyNum <= navItems.length) {
          event.preventDefault();
          const targetItem = navItems[keyNum - 1];
          if (targetItem) {
            activateNavTab(targetItem);
          }
        }
      }
    });

    activateNavTab(navItems[0]);
  };

  const setupSettingsSubnav = () => {
    const settingsSubnavItems = document.querySelectorAll(".settings-subnav-item");
    const settingsPanels = document.querySelectorAll(".settings-panel");
    settingsSubnavItems.forEach((item) => {
      item.addEventListener("click", () => {
        const panelId = item.dataset.settingsPanel;
        settingsSubnavItems.forEach((nav) => nav.classList.remove("active"));
        settingsPanels.forEach((panel) => panel.classList.remove("active"));

        item.classList.add("active");
        document.getElementById(panelId)?.classList.add("active");
      });
    });
  };

  return {
    activateNavTab,
    setupTabs,
    setupSettingsSubnav
  };
}

