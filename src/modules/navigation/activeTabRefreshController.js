import { refreshActiveTabView } from "./activeTabRefresh.js";

export function createActiveTabRefreshController(deps) {
  const refresh = () => refreshActiveTabView({
    normalizeEditableResultElement: deps.normalizeEditableResultElement,
    updateHomeIndicators: deps.updateHomeIndicators,
    updateTTSButtonsState: deps.updateTTSButtonsState,
    loadSavedBatchKeys: deps.loadSavedBatchKeys,
    getApiKeyInputValue: deps.getApiKeyInputValue,
    verifyKey: deps.verifyKey,
    setupModelComparison: deps.setupModelComparison,
    refreshModelComparisonOptions: deps.refreshModelComparisonOptions,
    applyCurrentCompareLayout: deps.applyCurrentCompareLayout,
    renderCompareAttachments: deps.renderCompareAttachments,
    setModelCompareStatus: deps.setModelCompareStatus,
    resetGeneralSettingsOverview: deps.resetGeneralSettingsOverview,
    populateGeneralSettingsOverview: deps.populateGeneralSettingsOverview,
    refreshShortcutDisplays: deps.refreshShortcutDisplays,
    loadAlertsLog: deps.loadAlertsLog,
    renderAlertsPanel: deps.renderAlertsPanel,
    loadTokenStats: deps.loadTokenStats,
    activateNavTab: deps.activateNavTab
  });

  return { refresh };
}
