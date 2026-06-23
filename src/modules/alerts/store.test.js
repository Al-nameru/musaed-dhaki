import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./store.js";

describe("getErrorMessage", () => {
  it("should handle Error instance", () => {
    expect(getErrorMessage(new Error("test"))).toBe("test");
  });
  it("should handle string", () => {
    expect(getErrorMessage("plain error")).toBe("plain error");
  });
  it("should handle null", () => {
    expect(getErrorMessage(null)).toBe("");
  });
  it("should handle object", () => {
    expect(getErrorMessage({ code: 404 })).toBe('{"code":404}');
  });
});
