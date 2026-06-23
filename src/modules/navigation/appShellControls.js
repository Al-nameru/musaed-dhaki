export function setupAppShellControls(deps) {
  document.getElementById("btn-refresh-app")?.addEventListener("click", async () => {
    deps.forceHideQuickTools();
    try {
      if (deps.isTauri) {
        await deps.invoke("hide_selection_overlay");
        setTimeout(() => deps.invoke("hide_selection_overlay").catch(() => {}), 150);
      }
    } catch (_err) {
      // Hiding the floating overlay is best-effort and should not block refresh.
    }
    await deps.refreshActiveTab();
  });

  window.addEventListener("pagehide", () => {
    deps.hideFloatingTextMenu();
    if (deps.isTauri) deps.invoke("hide_selection_overlay").catch(() => {});
  });

  const toggleBtn = document.getElementById("btn-toggle-sidebar");
  const appContainer = document.querySelector(".app-container");
  if (!toggleBtn || !appContainer) return;

  document.querySelectorAll(".nav-menu .nav-item").forEach((item) => {
    if (!item.title) item.title = item.textContent.trim();
  });

  if (localStorage.getItem("bm_sidebar_collapsed") === "true") {
    appContainer.classList.add("sidebar-collapsed");
  }
  toggleBtn.addEventListener("click", () => {
    const collapsed = appContainer.classList.toggle("sidebar-collapsed");
    localStorage.setItem("bm_sidebar_collapsed", collapsed ? "true" : "false");
    toggleBtn.setAttribute("aria-pressed", collapsed ? "true" : "false");
  });
}
