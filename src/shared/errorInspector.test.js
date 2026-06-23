import { describe, it, expect } from "vitest";
import { errorInspector } from "./errorInspector.js";

describe("errorInspector", () => {
  it("should capture console errors in consoleErrors log", () => {
    const initialCount = errorInspector.getConsoleErrors().length;
    
    console.error("This is a test console error");
    
    const logs = errorInspector.getConsoleErrors();
    expect(logs.length).toBe(initialCount + 1);
    expect(logs[logs.length - 1].message).toContain("This is a test console error");
  });
});
