import { setupFloatingSelectionToolbar } from "./floatingToolbar.js";
import { setupQuickActions } from "./quickActions.js";

export function createSelectionTools(refs, deps) {
  let floatingSelectionToolbar = null;

  const showFloatingTextMenu = (options = {}) => {
    return floatingSelectionToolbar?.showFloatingTextMenu(options) ?? false;
  };

  const hideFloatingTextMenu = (options = {}) => {
    return floatingSelectionToolbar?.hideFloatingTextMenu(options);
  };

  const forceHideQuickTools = () => {
    return floatingSelectionToolbar?.forceHideQuickTools();
  };

  const setSelectionMonitorEnabled = (enabled) => {
    return floatingSelectionToolbar?.setSelectionMonitorEnabled(enabled);
  };

  const quickActions = setupQuickActions({
    quickActionDialog: refs.quickActionDialog,
    quickActionTitle: refs.quickActionTitle,
    quickActionSubtitle: refs.quickActionSubtitle,
    quickActionSource: refs.quickActionSource,
    quickActionOutput: refs.quickActionOutput,
    quickActionStatus: refs.quickActionStatus,
    btnCloseQuickAction: refs.btnCloseQuickAction,
    btnSpeakQuickAction: refs.btnSpeakQuickAction,
    btnCopyQuickAction: refs.btnCopyQuickAction,
    btnInsertQuickAction: refs.btnInsertQuickAction
  }, {
    invoke: deps.invoke,
    getErrorMessage: deps.getErrorMessage,
    addAppAlert: deps.addAppAlert,
    getDiacritizeConfig: deps.getDiacritizeConfig,
    getActiveApiKey: deps.getActiveApiKey,
    getTextModel: deps.getTextModel,
    getSpeechLanguage: deps.getSpeechLanguage,
    getTtsRate: deps.getTtsRate,
    getTtsPitch: deps.getTtsPitch,
    getTtsVolume: deps.getTtsVolume,
    shouldSimulateTyping: deps.shouldSimulateTyping,
    hideFloatingTextMenu
  });

  floatingSelectionToolbar = setupFloatingSelectionToolbar({
    floatingMenu: refs.floatingMenu,
    menuStatus: refs.menuStatus,
    quickActionDialog: refs.quickActionDialog
  }, {
    invoke: deps.invoke,
    listen: deps.listen,
    addAppAlert: deps.addAppAlert,
    isTauri: deps.isTauri,
    isEnabled: deps.isEnabled,
    isShortcutRecording: deps.isShortcutRecording,
    openQuickAction: quickActions.openDialog
  });

  return {
    showFloatingTextMenu,
    hideFloatingTextMenu,
    forceHideQuickTools,
    setSelectionMonitorEnabled
  };
}
