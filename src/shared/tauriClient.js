export const isTauri = !!window.__TAURI__?.core?.invoke;

export const invoke = isTauri
  ? window.__TAURI__.core.invoke.bind(window.__TAURI__.core)
  : async (...args) => {
      console.warn("Tauri invoke unavailable in this environment.", ...args);
      return Promise.reject(new Error("Tauri invoke unavailable"));
    };

export const listen = isTauri && window.__TAURI__?.event?.listen
  ? window.__TAURI__.event.listen.bind(window.__TAURI__.event)
  : async (...args) => {
      console.warn("Tauri event listener unavailable in this environment.", ...args);
      return { unlisten: async () => {} };
    };
