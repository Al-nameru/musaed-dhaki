export function collectApiKeyRefs() {
  return {
    apiKeyInput: document.getElementById("input-api-key"),
    keyBadge: document.getElementById("key-status-badge"),
    keyInfoRow: document.getElementById("key-info-row"),
    detectedProvider: document.getElementById("detected-provider"),
    detectedValidity: document.getElementById("detected-validity"),
    selectProviderCompany: document.getElementById("select-provider-company"),
    selectFreeSttEngine: document.getElementById("select-free-stt-engine"),
    freeSttStatusMsg: document.getElementById("free-stt-status-msg"),
    modelsSelectorsContainer: document.getElementById("models-selectors-container"),
    modelsNoKeyWarning: document.getElementById("models-no-key-warning")
  };
}
