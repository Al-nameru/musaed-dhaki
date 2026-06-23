import { stateStore } from "../../shared/stateStore.js";

export const fallbackTextModels = {
  "Groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "gemma2-9b-it"],
  "Gemini": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
  "OpenAI": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  "Anthropic": ["claude-3-5-sonnet-latest", "claude-3-haiku-20240307"],
  "DeepSeek": ["deepseek-chat"],
  "Mistral": ["mistral-small-latest", "mistral-large-latest"],
  "OpenRouter": ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free"],
  "xAI": ["grok-beta"]
};

export async function initProviderKeys() {
  await stateStore.init();
  localStorage.removeItem("bm_provider_keys");
  localStorage.removeItem("bm_speech_api_key");
}

export function loadProviderKeys() {
  const providers = ["Gemini", "Groq", "OpenAI", "Anthropic", "DeepSeek", "Mistral", "OpenRouter", "xAI"];
  const keys = {};
  providers.forEach(p => {
    const k = stateStore.getApiKey(p);
    if (k) keys[p] = k;
  });
  return keys;
}

export function saveKeyToProviderStore(provider, key) {
  if (!key || !provider) return;
  try {
    let saved = localStorage.getItem("bm_provider_all_keys");
    let map = saved ? JSON.parse(saved) : {};
    if (!map[provider]) {
      map[provider] = [];
    }
    if (!map[provider].includes(key)) {
      map[provider].push(key);
      localStorage.setItem("bm_provider_all_keys", JSON.stringify(map));
    }
  } catch (e) {
    console.error("Failed to save key to provider store:", e);
  }
}

export function getProviderKeysList(provider) {
  const list = [];
  try {
    let saved = localStorage.getItem("bm_provider_all_keys");
    let map = saved ? JSON.parse(saved) : {};
    if (map[provider] && Array.isArray(map[provider])) {
      list.push(...map[provider]);
    }
  } catch (e) {}

  // Include primary keyring key if not already present
  const primary = stateStore.getApiKey(provider);
  if (primary && primary.trim() && !list.includes(primary)) {
    list.push(primary);
  }
  return list;
}

export function saveProviderKey(provider, key) {
  stateStore.saveApiKey(provider, key);
  saveKeyToProviderStore(provider, key);
}

export function loadProviderModels() {
  try {
    const models = JSON.parse(localStorage.getItem("bm_provider_models") || "{}");
    return models && typeof models === "object" ? models : {};
  } catch (e) {
    return {};
  }
}

export function cacheProviderModels(provider, models) {
  const cached = loadProviderModels();
  cached[provider] = models || [];
  localStorage.setItem("bm_provider_models", JSON.stringify(cached));
}

export function getCachedOrFallbackTextModels(provider) {
  const cached = loadProviderModels();
  return cached[provider] || fallbackTextModels[provider] || [];
}

export function getComparisonProviders({ activeProvider = "", activeApiKey = "" } = {}) {
  const keys = loadProviderKeys();
  const providers = Object.keys(keys).filter(provider => provider !== "Google" && !!keys[provider]);
  if (activeProvider && activeProvider !== "Google" && activeApiKey && !providers.includes(activeProvider)) {
    providers.unshift(activeProvider);
  }
  return providers.length ? providers : Object.keys(fallbackTextModels);
}

export function getComparisonModels(provider) {
  const models = getCachedOrFallbackTextModels(provider);
  const filtered = models.filter(model => {
    const lower = model.toLowerCase();
    return model && !lower.includes("whisper") && model !== "google-webspeech" && model !== "none";
  });
  return filtered.length ? filtered : ["default"];
}

export function getProviderKey(provider, { activeProvider = "", activeApiKey = "" } = {}) {
  const k = stateStore.getApiKey(provider);
  if (k) return k;
  if (provider === activeProvider && activeApiKey) return activeApiKey;
  return "";
}

