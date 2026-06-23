export async function refreshActiveTabView(deps) {
  const activeNav = document.querySelector(".nav-menu .nav-item.active");
  const activePane = document.querySelector(".tab-pane.active");
  const activeTab = activeNav?.dataset.tab || activePane?.id || "";

  switch (activeTab) {
    case "tab-home":
      deps.normalizeEditableResultElement();
      deps.updateHomeIndicators();
      deps.updateTTSButtonsState("stopped");
      break;
    case "tab-keys": {
      deps.loadSavedBatchKeys();
      const key = deps.getApiKeyInputValue().trim();
      if (key) await deps.verifyKey(key);
      deps.updateHomeIndicators();
      break;
    }
    case "tab-compare":
      deps.setupModelComparison();
      deps.refreshModelComparisonOptions();
      deps.applyCurrentCompareLayout();
      deps.renderCompareAttachments();
      deps.setModelCompareStatus("تم تحديث تبويب المقارنة.");
      break;
    case "tab-settings":
      deps.resetGeneralSettingsOverview();
      deps.populateGeneralSettingsOverview();
      deps.refreshShortcutDisplays();
      deps.updateHomeIndicators();
      break;
    case "tab-alerts":
      deps.loadAlertsLog();
      deps.renderAlertsPanel();
      break;
    case "tab-stats":
      await deps.loadTokenStats();
      break;
    default:
      if (activeNav) deps.activateNavTab(activeNav);
      break;
  }
}
