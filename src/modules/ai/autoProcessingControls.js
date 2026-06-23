export function setupAutoProcessingControls(refs, deps) {
  const {
    chkHomeAutoDiacritize,
    chkSettingsAutoDiacritize,
    chkHomeAutoGrammar,
    chkSettingsAutoGrammar,
    chkHomeVoiceTranslation,
    chkSettingsVoiceTranslation
  } = refs;

  const savedAutoDiacritize = localStorage.getItem("bm_auto_diacritize") === "true";
  deps.setAutoDiacritize(savedAutoDiacritize);
  if (chkHomeAutoDiacritize) chkHomeAutoDiacritize.checked = savedAutoDiacritize;
  if (chkSettingsAutoDiacritize) chkSettingsAutoDiacritize.checked = savedAutoDiacritize;

  const savedAutoGrammar = localStorage.getItem("bm_auto_grammar") === "true";
  deps.setAutoGrammar(savedAutoGrammar);
  if (chkHomeAutoGrammar) chkHomeAutoGrammar.checked = savedAutoGrammar;
  if (chkSettingsAutoGrammar) chkSettingsAutoGrammar.checked = savedAutoGrammar;

  const savedVoiceTranslation = localStorage.getItem("bm_voice_translation") === "true";
  deps.setVoiceTranslation?.(savedVoiceTranslation);
  if (chkHomeVoiceTranslation) chkHomeVoiceTranslation.checked = savedVoiceTranslation;
  if (chkSettingsVoiceTranslation) chkSettingsVoiceTranslation.checked = savedVoiceTranslation;

  const setDiacritize = async (checked) => {
    deps.setAutoDiacritize(checked);
    localStorage.setItem("bm_auto_diacritize", checked.toString());
    if (chkHomeAutoDiacritize) chkHomeAutoDiacritize.checked = checked;
    if (chkSettingsAutoDiacritize) chkSettingsAutoDiacritize.checked = checked;
    if (checked) {
      await deps.onAutoDiacritizeEnabled();
    }
  };

  chkHomeAutoDiacritize?.addEventListener("change", (e) => {
    setDiacritize(e.target.checked);
  });

  chkSettingsAutoDiacritize?.addEventListener("change", (e) => {
    setDiacritize(e.target.checked);
  });

  const setGrammar = (checked) => {
    deps.setAutoGrammar(checked);
    localStorage.setItem("bm_auto_grammar", checked.toString());
    if (chkHomeAutoGrammar) chkHomeAutoGrammar.checked = checked;
    if (chkSettingsAutoGrammar) chkSettingsAutoGrammar.checked = checked;
  };

  chkHomeAutoGrammar?.addEventListener("change", (e) => {
    setGrammar(e.target.checked);
  });

  chkSettingsAutoGrammar?.addEventListener("change", (e) => {
    setGrammar(e.target.checked);
  });

  const setVoiceTranslation = (checked) => {
    deps.setVoiceTranslation?.(checked);
    localStorage.setItem("bm_voice_translation", checked.toString());
    if (chkHomeVoiceTranslation) chkHomeVoiceTranslation.checked = checked;
    if (chkSettingsVoiceTranslation) chkSettingsVoiceTranslation.checked = checked;
  };

  chkHomeVoiceTranslation?.addEventListener("change", (e) => {
    setVoiceTranslation(e.target.checked);
  });

  chkSettingsVoiceTranslation?.addEventListener("change", (e) => {
    setVoiceTranslation(e.target.checked);
  });
}
