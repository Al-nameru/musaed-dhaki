export function waitForAppDomReady() {
  const domReady = document.readyState === "loading"
    ? new Promise((resolve) => window.addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();

  return domReady.then(() => window.smartAssistantPartialsReady || Promise.resolve());
}
