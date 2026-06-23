export function collectSelectionToolRefs() {
  return {
    floatingMenu: document.getElementById("floating-menu"),
    menuStatus: document.getElementById("menu-status"),
    quickActionDialog: document.getElementById("quick-action-dialog"),
    quickActionTitle: document.getElementById("quick-action-title"),
    quickActionSubtitle: document.getElementById("quick-action-subtitle"),
    quickActionSource: document.getElementById("quick-action-source"),
    quickActionOutput: document.getElementById("quick-action-output"),
    quickActionStatus: document.getElementById("quick-action-status"),
    btnCloseQuickAction: document.getElementById("btn-close-quick-action"),
    btnSpeakQuickAction: document.getElementById("btn-speak-quick-action"),
    btnCopyQuickAction: document.getElementById("btn-copy-quick-action"),
    btnInsertQuickAction: document.getElementById("btn-insert-quick-action")
  };
}
