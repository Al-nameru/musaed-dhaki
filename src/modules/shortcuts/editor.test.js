import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getShortcutDisplayString,
  isBareModifierShortcut,
  normalizeSttShortcutBehavior,
  normalizeTextShortcutBehavior,
  setupShortcutEditor
} from "./editor.js";
import { stateStore } from "../../shared/stateStore.js";

// Mock stateStore
vi.mock("../../shared/stateStore.js", () => ({
  stateStore: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}));

describe("editor shortcut logic", () => {
  describe("isBareModifierShortcut", () => {
    it("should identify CONTROL, SHIFT, ALT as bare modifier shortcuts when no other modifiers are active", () => {
      expect(isBareModifierShortcut({ ctrl: true, shift: false, alt: false, key: "CONTROL" })).toBe(true);
      expect(isBareModifierShortcut({ ctrl: false, shift: true, alt: false, key: "SHIFT" })).toBe(true);
      expect(isBareModifierShortcut({ ctrl: false, shift: false, alt: true, key: "ALT" })).toBe(true);

      // Should be false if other modifiers are active
      expect(isBareModifierShortcut({ ctrl: true, shift: true, alt: false, key: "CONTROL" })).toBe(false);
      expect(isBareModifierShortcut({ ctrl: true, shift: false, alt: false, key: "V" })).toBe(false);
    });
  });

  describe("normalize behaviors", () => {
    it("should normalize behaviors properly", () => {
      expect(normalizeSttShortcutBehavior("hold")).toBe("hold");
      expect(normalizeSttShortcutBehavior("invalid")).toBe("toggle");

      expect(normalizeTextShortcutBehavior("double")).toBe("double");
      expect(normalizeTextShortcutBehavior("invalid")).toBe("single");
    });
  });
});
