import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readResultText,
  writeResultText,
  insertTextAtCursor,
  applyResultTextValue
} from "./resultText.js";

describe("resultText module", () => {
  let textarea;
  let div;

  beforeEach(() => {
    // Set up mock DOM elements
    textarea = document.createElement("textarea");
    textarea.value = "initial text";
    
    div = document.createElement("div");
    div.textContent = "div text";
  });

  describe("readResultText", () => {
    it("should read value from textarea/input", () => {
      expect(readResultText(textarea)).toBe("initial text");
    });

    it("should read textContent/innerText from div", () => {
      expect(readResultText(div)).toBe("div text");
    });

    it("should return empty string if element is null", () => {
      expect(readResultText(null)).toBe("");
    });
  });

  describe("writeResultText", () => {
    it("should write value to textarea/input", () => {
      writeResultText(textarea, "new text");
      expect(textarea.value).toBe("new text");
    });

    it("should write textContent to div", () => {
      writeResultText(div, "new div text");
      expect(div.textContent).toBe("new div text");
    });

    it("should not throw if element is null", () => {
      expect(() => writeResultText(null, "new text")).not.toThrow();
    });
  });

  describe("insertTextAtCursor", () => {
    it("should insert text at cursor for textarea", () => {
      textarea.value = "hello world";
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;
      insertTextAtCursor(textarea, " dear");
      expect(textarea.value).toBe("hello dear world");
    });
  });

  describe("applyResultTextValue", () => {
    it("should replace text when mode is replace", () => {
      const deps = {
        setSuppressInput: vi.fn(),
        setLastAutoDiacritizeSource: vi.fn(),
        getTextInsertionMode: () => "replace"
      };
      applyResultTextValue(textarea, "replaced text", deps);
      expect(textarea.value).toBe("replaced text");
      expect(deps.setSuppressInput).toHaveBeenCalledWith(true);
      expect(deps.setSuppressInput).toHaveBeenCalledWith(false);
      expect(deps.setLastAutoDiacritizeSource).toHaveBeenCalledWith("replaced text");
    });

    it("should append space when mode is append-space", () => {
      const deps = {
        setSuppressInput: vi.fn(),
        setLastAutoDiacritizeSource: vi.fn(),
        getTextInsertionMode: () => "append-space"
      };
      applyResultTextValue(textarea, "appended", deps);
      expect(textarea.value).toBe("initial text appended");
    });

    it("should append newline when mode is append-newline", () => {
      const deps = {
        setSuppressInput: vi.fn(),
        setLastAutoDiacritizeSource: vi.fn(),
        getTextInsertionMode: () => "append-newline"
      };
      applyResultTextValue(textarea, "appended", deps);
      expect(textarea.value).toBe("initial text\nappended");
    });
  });
});
