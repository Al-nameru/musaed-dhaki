import { vi } from "vitest";

const store = {};
const mockLocalStorage = {
  getItem: (key) => store[key] !== undefined ? store[key] : null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  length: 0,
  key: (index) => Object.keys(store)[index] || null
};

if (typeof window !== "undefined") {
  if (!window.localStorage) {
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true
    });
  }
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = mockLocalStorage;
}
