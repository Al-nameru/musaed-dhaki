export function createSttShortcutBridge(deps) {
  const start = (isShortcut = false) => {
    if (!deps.isRecording() && deps.getRecordingState() === "idle") {
      if (deps.getFreeSttEngine() !== "none") {
        deps.toggleFreeSpeechRecognition(isShortcut);
      } else {
        deps.startRecording(isShortcut);
      }
    }
  };

  const stop = (isShortcut = false) => {
    if (deps.isRecording() || deps.getRecordingState() === "recording" || deps.getRecordingState() === "starting") {
      if (deps.getFreeSttEngine() !== "none") {
        deps.toggleFreeSpeechRecognition(isShortcut);
      } else {
        deps.stopRecording();
      }
    }
  };

  return { start, stop };
}
