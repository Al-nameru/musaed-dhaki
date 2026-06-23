export function attachRecordButtonHandler({ getButton, toggleRecording }) {
  const attach = (button) => {
    if (!button || button._hasToggleListener) return false;
    button.addEventListener("click", toggleRecording);
    button._hasToggleListener = true;
    return true;
  };

  try {
    attach(getButton());
  } catch (e) {}

  setTimeout(() => {
    try {
      attach(getButton());
    } catch (e) {}
  }, 250);

  let attempts = 0;
  const id = setInterval(() => {
    attempts += 1;
    try {
      if (attach(getButton())) {
        clearInterval(id);
        return;
      }
    } catch (e) {}
    if (attempts > 20) clearInterval(id);
  }, 200);
}
