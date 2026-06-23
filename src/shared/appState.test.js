import { describe, it, expect } from "vitest";
import { appState } from "./appState.js";

describe("appState", () => {
  it("should get and set activeApiKey", () => {
    appState.set("activeApiKey", "test-key");
    expect(appState.get("activeApiKey")).toBe("test-key");
  });

  it("should trigger subscribers on change", () => {
    let calledVal = null;
    const unsub = appState.subscribe("speechModel", (val) => {
      calledVal = val;
    });

    appState.set("speechModel", "whisper-1");
    expect(calledVal).toBe("whisper-1");

    unsub();
  });
});
