import { loadAlertsLog, renderAlertsPanel } from "../modules/alerts/store.js";
import { loadSavedBatchKeys } from "../modules/apiKeys/batchKeys.js";
import { createActiveTabRefreshController } from "../modules/navigation/activeTabRefreshController.js";
import { refreshShortcutDisplays } from "../modules/shortcuts/editor.js";
import { loadTokenStats } from "../modules/stats/tokenStats.js";

export function createActiveTabRuntime(deps) {
  return createActiveTabRefreshController({
    normalizeEditableResultElement: deps.normalizeEditableResultElement,
    updateHomeIndicators: deps.updateHomeIndicators,
    updateTTSButtonsState: deps.updateTTSButtonsState,
    loadSavedBatchKeys,
    getApiKeyInputValue: deps.getApiKeyInputValue,
    verifyKey: deps.verifyKey,
    setupModelComparison: deps.modelComparison.setup,
    refreshModelComparisonOptions: deps.modelComparison.refreshOptions,
    applyCurrentCompareLayout: deps.modelComparison.applyCurrentLayout,
    renderCompareAttachments: deps.modelComparison.renderAttachments,
    setModelCompareStatus: deps.modelComparison.setStatus,
    resetGeneralSettingsOverview: deps.resetGeneralSettingsOverview,
    populateGeneralSettingsOverview: deps.populateGeneralSettingsOverview,
    refreshShortcutDisplays: () => refreshShortcutDisplays({
      sttBehavior: deps.getSttShortcutBehavior(),
      textBehavior: deps.getTextShortcutBehavior()
    }),
    loadAlertsLog,
    renderAlertsPanel,
    loadTokenStats,
    activateNavTab: deps.activateNavTab
  });
}
