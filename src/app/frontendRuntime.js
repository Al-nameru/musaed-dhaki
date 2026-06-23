import { setupAppShellControls } from "../modules/navigation/appShellControls.js";
import { createSelectionToolsFromDocument } from "../modules/selection/bootstrap.js";
import { setupRuntimeShortcutHandler } from "../modules/shortcuts/runtime.js";

export function setupFrontendRuntime(deps) {
  const selectionTools = createSelectionToolsFromDocument({
    invoke: deps.invoke,
    listen: deps.listen,
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
    isTauri: deps.isTauri,
    isEnabled: deps.isSelectionMenuEnabled,
    isShortcutRecording: deps.isShortcutRecording
  });

  const showFloatingTextMenu = (options = {}) => selectionTools.showFloatingTextMenu(options);
  const hideFloatingTextMenu = (options = {}) => selectionTools.hideFloatingTextMenu(options);
  const forceHideQuickTools = () => selectionTools.forceHideQuickTools();
  const setSelectionMonitorEnabled = (enabled) => selectionTools.setSelectionMonitorEnabled(enabled);

  setupRuntimeShortcutHandler({
    listen: deps.listen,
    getSttBehavior: deps.getSttBehavior,
    getTextBehavior: deps.getTextBehavior,
    isRecordingActive: deps.isRecordingActive,
    startStt: deps.startStt,
    stopStt: deps.stopStt,
    toggleRecording: deps.toggleRecording,
    showTextTools: showFloatingTextMenu
  });

  setupAppShellControls({
    isTauri: deps.isTauri(),
    invoke: deps.invoke,
    refreshActiveTab: deps.refreshActiveTab,
    forceHideQuickTools,
    hideFloatingTextMenu
  });

  return {
    showFloatingTextMenu,
    hideFloatingTextMenu,
    forceHideQuickTools,
    setSelectionMonitorEnabled
  };
}
