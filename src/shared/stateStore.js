import { invoke } from "./tauriClient.js";
import { handleError } from "./errorHandler.js";

function isQuotaExceededError(err) {
  return err && (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

function pruneStorageToFreeSpace() {
  console.warn("[Storage] LocalStorage quota exceeded. Attempting to free space by pruning non-essential data...");
  try {
    if (typeof localStorage === "undefined" || !localStorage) {
      console.warn("[Storage] LocalStorage is not available to prune.");
      return;
    }

    // Always explicitly delete known non-essential keys to support test mocks
    const knownKeys = ["bm_provider_models", "bm_batch_keys", "bm_failed_keys", "bm_alerts_log"];
    knownKeys.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (err) {}
    });

    const essentialKeys = new Set([
      "bm_speech_provider",
      "bm_speech_language",
      "bm_speech_model",
      "bm_text_model",
      "bm_speech_api_key",
      "bm_live_transcription_enabled",
      "bm_selection_floating_menu_enabled",
      "bm_text_output_target",
      "bm_append_mode",
      "bm_stt_shortcut_behavior",
      "bm_text_shortcut_behavior",
      "bm_shortcut_defaults_v2",
      "bm_shortcut_stt",
      "bm_shortcut_text",
      "bm_diacritize_provider",
      "bm_diacritize_model",
      "bm_append_separator",
      "bm_text_insertion_mode",
      "bm_background_recording_enabled"
    ]);

    if (typeof localStorage.length === "number" && typeof localStorage.key === "function") {
      console.info("[Storage] Current LocalStorage keys and sizes:");
      let totalSize = 0;
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || "";
        const size = val.length * 2; // approximation in bytes (UTF-16)
        totalSize += size;
        console.info(`  - ${key}: ${(size / 1024).toFixed(2)} KB`);

        const isEssential = essentialKeys.has(key);
        const isTooLarge = size > 20 * 1024; // 20 KB limit

        if (key.startsWith("bm_") && (!isEssential || isTooLarge)) {
          keysToRemove.push(key);
          if (isTooLarge && isEssential) {
            console.warn(`[Storage] Essential key "${key}" is abnormally large (${(size / 1024).toFixed(2)} KB) and likely corrupt. Scheduling for pruning.`);
          }
        }
      }
      console.info(`[Storage] Total LocalStorage size: ${(totalSize / 1024).toFixed(2)} KB`);

      if (keysToRemove.length > 0) {
        console.warn(`[Storage] Pruning recognized non-essential keys: ${keysToRemove.join(", ")}`);
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (err) {}
        });
      }
    }
    console.info("[Storage] Successfully freed space in LocalStorage.");
  } catch (e) {
    console.error("[Storage] Failed to prune LocalStorage:", e);
  }
}

let originalSetItem = null;
if (typeof Storage !== "undefined" && typeof Storage.prototype.setItem === "function") {
  originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    try {
      originalSetItem.call(this, key, value);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        pruneStorageToFreeSpace();
        try {
          originalSetItem.call(this, key, value);
        } catch (retryErr) {
          throw retryErr;
        }
      } else {
        throw e;
      }
    }
  };
}

let apiKeysCache = {};
const memoryStore = {};

const getStorage = () => {
  if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.setItem === "function") {
    return localStorage;
  }
  return {
    getItem: (key) => memoryStore[key] !== undefined ? memoryStore[key] : null,
    setItem: (key, value) => { memoryStore[key] = String(value); },
    removeItem: (key) => { delete memoryStore[key]; }
  };
};

function safeSetItem(key, value) {
  const storage = getStorage();
  try {
    storage.setItem(key, value);
  } catch (e) {
    if (isQuotaExceededError(e)) {
      pruneStorageToFreeSpace();
      try {
        if (originalSetItem && (typeof Storage !== "undefined" && storage instanceof Storage)) {
          originalSetItem.call(storage, key, value);
        } else {
          storage.setItem(key, value);
        }
      } catch (retryErr) {
        console.warn(`[Storage] Failed to save key "${key}" to localStorage even after pruning. Falling back to memory store.`, retryErr);
        memoryStore[key] = String(value);
      }
    } else {
      throw e;
    }
  }
}

/**
 * @typedef {Object} StateStore
 * @property {Function} init - Initializes secure API key cache by calling Tauri backend
 * @property {Function} getApiKey - Returns cached API key for a provider
 * @property {Function} saveApiKey - Saves API key to secure backend and caches it
 * @property {Function} deleteApiKey - Removes API key from secure backend and cache
 * @property {Function} getItem - Wrapper around localStorage.getItem with fallback
 * @property {Function} setItem - Wrapper around localStorage.setItem
 * @property {Function} removeItem - Wrapper around localStorage.removeItem
 */

/** @type {StateStore} */
export const stateStore = {
  async init() {
    try {
      apiKeysCache = await invoke("load_all_secure_api_keys") || {};
    } catch (e) {
      handleError(e, { source: "stateStore.init" });
      apiKeysCache = {};
    }
  },

  getApiKey(provider) {
    return apiKeysCache[provider] || "";
  },

  async saveApiKey(provider, key) {
    apiKeysCache[provider] = key;
    try {
      await invoke("save_secure_api_key", { provider, key });
    } catch (e) {
      handleError(e, { source: "stateStore.saveApiKey" });
    }
  },

  async deleteApiKey(provider) {
    delete apiKeysCache[provider];
    try {
      await invoke("delete_secure_api_key", { provider });
    } catch (e) {
      handleError(e, { source: "stateStore.deleteApiKey" });
    }
  },

  getItem(key, fallback = null) {
    if (memoryStore[key] !== undefined) {
      return memoryStore[key];
    }
    try {
      const val = getStorage().getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      handleError(e, { silent: true, source: "stateStore.getItem" });
      return fallback;
    }
  },

  getJSON(key, fallback = null) {
    if (memoryStore[key] !== undefined) {
      try {
        return JSON.parse(memoryStore[key]);
      } catch (e) {
        const raw = memoryStore[key];
        if (raw === "true") return true;
        if (raw === "false") return false;
        return raw;
      }
    }
    try {
      const val = getStorage().getItem(key);
      if (val === null) return fallback;
      return JSON.parse(val);
    } catch (e) {
      try {
        const raw = getStorage().getItem(key);
        if (raw !== null) {
          // If it is just a string, return it as is
          if (raw === "true") return true;
          if (raw === "false") return false;
          return raw;
        }
      } catch (err) {}
      handleError(e, { silent: true, source: "stateStore.getJSON" });
      return fallback;
    }
  },

  setItem(key, value) {
    try {
      safeSetItem(key, value);
    } catch (e) {
      handleError(e, { source: `stateStore.setItem[key=${key}]` });
    }
  },

  setJSON(key, value) {
    try {
      safeSetItem(key, JSON.stringify(value));
    } catch (e) {
      handleError(e, { source: `stateStore.setJSON[key=${key}]` });
    }
  },

  removeItem(key) {
    delete memoryStore[key];
    try {
      getStorage().removeItem(key);
    } catch (e) {
      handleError(e, { source: `stateStore.removeItem[key=${key}]` });
    }
  }
};
