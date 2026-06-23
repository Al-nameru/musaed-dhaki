export function createExternalTargetCapture({ isTauri, invoke, getTextOutputTarget }) {
  let captured = false;

  const capture = async () => {
    captured = false;
    if (!isTauri) return;

    const textOutputTarget = getTextOutputTarget();
    const wantsExternal = textOutputTarget === "external" || textOutputTarget === "both";
    if (!wantsExternal) return;

    try {
      captured = (await invoke("capture_external_target")) === true;
    } catch (err) {
      console.error("capture_external_target failed:", err);
      captured = false;
    }
  };

  return {
    capture,
    wasCaptured: () => captured
  };
}
