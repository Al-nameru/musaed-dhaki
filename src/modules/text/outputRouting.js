export function resolveTextOutputRoute({ textOutputTarget, isTauri, externalTargetCaptured }) {
  const shouldWriteToApp = textOutputTarget === "app" || textOutputTarget === "both";
  const shouldWriteToExternal = textOutputTarget === "external" || textOutputTarget === "both";
  const canWriteExternal = isTauri && shouldWriteToExternal && externalTargetCaptured;
  const redirectedToApp = shouldWriteToExternal && !canWriteExternal && !shouldWriteToApp;

  return {
    shouldWriteToApp,
    shouldWriteToExternal,
    canWriteExternal,
    redirectedToApp,
    shouldApplyToApp: shouldWriteToApp || redirectedToApp
  };
}

export async function writeTextToExternalTarget(text, options) {
  await options.invoke("write_to_system", {
    text,
    simulateTyping: options.simulateTyping,
    useLastSelectionTarget: true
  });
}
