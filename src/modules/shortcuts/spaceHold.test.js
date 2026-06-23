import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupSpaceHoldShortcut } from "./spaceHold.js";

describe("setupSpaceHoldShortcut", () => {
  let mockDeps;
  let clearSpaceHold;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDeps = {
      isShortcutRecording: vi.fn().mockReturnValue(false),
      getSttShortcut: vi.fn().mockReturnValue({ ctrl: true, shift: false, alt: false, key: "CONTROL" }),
      getSttShortcutBehavior: vi.fn().mockReturnValue("hold"),
      isRecordingActive: vi.fn().mockReturnValue(false),
      startStt: vi.fn(),
      stopStt: vi.fn(),
      toggleRecording: vi.fn()
    };
    clearSpaceHold = setupSpaceHoldShortcut(mockDeps);
  });

  afterEach(() => {
    clearSpaceHold();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should trigger startStt when Control key is held down past the delay under hold behavior", () => {
    const event = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(event);

    expect(mockDeps.startStt).not.toHaveBeenCalled();

    // Advance time by 650ms
    vi.advanceTimersByTime(650);

    expect(mockDeps.startStt).toHaveBeenCalledTimes(1);
  });

  it("should trigger stopStt on keyup if Control key hold was triggered", () => {
    const downEvent = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(downEvent);

    vi.advanceTimersByTime(650);
    expect(mockDeps.startStt).toHaveBeenCalledTimes(1);

    const upEvent = new KeyboardEvent("keyup", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(upEvent);

    expect(mockDeps.stopStt).toHaveBeenCalledTimes(1);
  });

  it("should cancel hold timer if a different key is pressed while Control is down", () => {
    const downCtrl = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(downCtrl);

    // Press 'c' key (e.g. Ctrl + C)
    const downC = new KeyboardEvent("keydown", { key: "c", code: "KeyC", ctrlKey: true });
    window.dispatchEvent(downC);

    vi.advanceTimersByTime(650);

    expect(mockDeps.startStt).not.toHaveBeenCalled();
  });

  it("should work with SPACE key as shortcut and cleanup trailing space if in text input", () => {
    mockDeps.getSttShortcut.mockReturnValue({ ctrl: false, shift: false, alt: false, key: "SPACE" });
    mockDeps.getSttShortcutBehavior.mockReturnValue("long_press_start");

    const input = document.createElement("input");
    input.type = "text";
    input.value = "hello ";
    input.selectionStart = 6;
    input.selectionEnd = 6;
    document.body.appendChild(input);

    const downSpace = new KeyboardEvent("keydown", { key: " ", code: "Space" });
    Object.defineProperty(downSpace, "target", { value: input, writable: false });
    window.dispatchEvent(downSpace);

    vi.advanceTimersByTime(650);

    expect(mockDeps.toggleRecording).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("hello");

    document.body.removeChild(input);
  });

  it("should toggle recording immediately on toggle behavior", () => {
    mockDeps.getSttShortcutBehavior.mockReturnValue("toggle");

    const event = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(event);

    expect(mockDeps.toggleRecording).toHaveBeenCalledTimes(1);
  });

  it("should start recording only on double press within 350ms on double behavior", () => {
    mockDeps.getSttShortcutBehavior.mockReturnValue("double");

    const event1 = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(event1);
    expect(mockDeps.toggleRecording).not.toHaveBeenCalled();

    // Wait 200ms
    vi.advanceTimersByTime(200);

    const event2 = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(event2);
    expect(mockDeps.toggleRecording).toHaveBeenCalledTimes(1);
  });

  it("should stop recording immediately on press if recording is active under double behavior", () => {
    mockDeps.getSttShortcutBehavior.mockReturnValue("double");
    mockDeps.isRecordingActive.mockReturnValue(true);

    const event = new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft" });
    window.dispatchEvent(event);

    expect(mockDeps.toggleRecording).toHaveBeenCalledTimes(1); // should call toggle to stop
  });
});
