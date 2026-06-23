import { describe, it, expect } from "vitest";
import { stateStore } from "./stateStore.js";

describe("stateStore", () => {
  it("should return fallback when key does not exist", () => {
    expect(stateStore.getItem("non-existing-key-xyz", "my-fallback")).toBe("my-fallback");
  });

  it("should set and get item in localStorage", () => {
    stateStore.setItem("test-item-abc", "hello");
    expect(stateStore.getItem("test-item-abc")).toBe("hello");
    stateStore.removeItem("test-item-abc");
    expect(stateStore.getItem("test-item-abc")).toBeNull();
  });

  it("should recover from QuotaExceededError by pruning non-essential data", () => {
    const originalLocalStorage = globalThis.localStorage;
    let quotaErrorTriggered = false;
    const store = {};

    const mockStorage = {
      getItem: (key) => store[key] !== undefined ? store[key] : null,
      removeItem: (key) => { delete store[key]; },
      setItem: (key, value) => {
        if (!quotaErrorTriggered && key === "bm_speech_language") {
          quotaErrorTriggered = true;
          const err = new Error("exceeded the quota");
          err.name = "QuotaExceededError";
          err.code = 22;
          throw err;
        }
        store[key] = String(value);
      }
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true
      });
    }

    try {
      localStorage.setItem("bm_alerts_log", "some-large-log-data");
      localStorage.setItem("bm_provider_models", "some-large-models-data");

      stateStore.setItem("bm_speech_language", "ar");
      
      // Verify retry succeeded
      expect(localStorage.getItem("bm_speech_language")).toBe("ar");
      
      // Verify non-essential items were cleared to free space
      expect(localStorage.getItem("bm_alerts_log")).toBeNull();
      expect(localStorage.getItem("bm_provider_models")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        writable: true,
        configurable: true
      });
      if (typeof window !== "undefined") {
        Object.defineProperty(window, "localStorage", {
          value: originalLocalStorage,
          writable: true,
          configurable: true
        });
      }
    }
  });

  it("should prune essential keys if they are abnormally large (>20KB) to resolve corruption", () => {
    const originalLocalStorage = globalThis.localStorage;
    let quotaErrorTriggered = false;
    const store = {};

    const mockStorage = {
      getItem: (key) => store[key] !== undefined ? store[key] : null,
      removeItem: (key) => { delete store[key]; },
      length: 1,
      key: (index) => "bm_speech_language",
      setItem: (key, value) => {
        if (!quotaErrorTriggered && key === "bm_speech_language" && value === "ar") {
          quotaErrorTriggered = true;
          const err = new Error("exceeded the quota");
          err.name = "QuotaExceededError";
          err.code = 22;
          throw err;
        }
        store[key] = String(value);
      }
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true
    });

    try {
      store["bm_speech_language"] = "x".repeat(25000); 

      stateStore.setItem("bm_speech_language", "ar");
      
      expect(localStorage.getItem("bm_speech_language")).toBe("ar");
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        writable: true,
        configurable: true
      });
    }
  });
});

