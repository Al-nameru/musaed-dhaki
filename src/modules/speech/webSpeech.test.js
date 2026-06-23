import { describe, it, expect, vi } from "vitest";
import { finalizeWebSpeechSessionFlow } from "./webSpeechFinalize.js";

describe("finalizeWebSpeechSessionFlow", () => {
  it("should call applyResultText if mode is insert-cursor", async () => {
    const mockDeps = {
      setIsRecording: vi.fn(),
      setRecordingState: vi.fn(),
      setManualStopRequested: vi.fn(),
      setRecognitionInstance: vi.fn(),
      setRecordButtonRecording: vi.fn(),
      playStopBeepSound: vi.fn(),
      getWebSpeechFinal: vi.fn().mockReturnValue("hello"),
      getWebSpeechBase: vi.fn().mockReturnValue(""),
      getWebSpeechOriginalText: vi.fn().mockReturnValue("original"),
      getStatus: vi.fn().mockReturnValue(""),
      setStatus: vi.fn(),
      applyAutomaticTextProcessing: vi.fn().mockImplementation((t) => Promise.resolve(t)),
      resolveTextOutputRoute: vi.fn().mockReturnValue({ shouldApplyToApp: true, canWriteExternal: false }),
      getTextOutputTarget: vi.fn().mockReturnValue("app"),
      isTauri: false,
      getExternalTargetCaptured: vi.fn().mockReturnValue(false),
      getTextInsertionMode: vi.fn().mockReturnValue("insert-cursor"),
      setSuppressResultTextInput: vi.fn(),
      setResultText: vi.fn(),
      applyResultText: vi.fn(),
      setLastAutoDiacritizeSource: vi.fn(),
      getAutoGrammar: vi.fn().mockReturnValue(false),
      getAutoDiacritize: vi.fn().mockReturnValue(false),
      getActiveApiKey: vi.fn().mockReturnValue(""),
      getTextModel: vi.fn().mockReturnValue(""),
      addAppAlert: vi.fn(),
      invoke: vi.fn()
    };

    await finalizeWebSpeechSessionFlow(mockDeps);

    expect(mockDeps.applyResultText).toHaveBeenCalledWith("hello");
    expect(mockDeps.setResultText).toHaveBeenCalledWith("original");
  });

  it("should call applyResultText and clean box for other modes", async () => {
    const mockDeps = {
      setIsRecording: vi.fn(),
      setRecordingState: vi.fn(),
      setManualStopRequested: vi.fn(),
      setRecognitionInstance: vi.fn(),
      setRecordButtonRecording: vi.fn(),
      playStopBeepSound: vi.fn(),
      getWebSpeechFinal: vi.fn().mockReturnValue("hello"),
      getWebSpeechBase: vi.fn().mockReturnValue("base "),
      getWebSpeechOriginalText: vi.fn().mockReturnValue("base"),
      getStatus: vi.fn().mockReturnValue(""),
      setStatus: vi.fn(),
      applyAutomaticTextProcessing: vi.fn().mockImplementation((t) => Promise.resolve(t)),
      resolveTextOutputRoute: vi.fn().mockReturnValue({ shouldApplyToApp: true, canWriteExternal: false }),
      getTextOutputTarget: vi.fn().mockReturnValue("app"),
      isTauri: false,
      getExternalTargetCaptured: vi.fn().mockReturnValue(false),
      getTextInsertionMode: vi.fn().mockReturnValue("append-space"),
      setSuppressResultTextInput: vi.fn(),
      setResultText: vi.fn(),
      applyResultText: vi.fn(),
      setLastAutoDiacritizeSource: vi.fn(),
      getAutoGrammar: vi.fn().mockReturnValue(false),
      getAutoDiacritize: vi.fn().mockReturnValue(false),
      getActiveApiKey: vi.fn().mockReturnValue(""),
      getTextModel: vi.fn().mockReturnValue(""),
      addAppAlert: vi.fn(),
      invoke: vi.fn()
    };

    await finalizeWebSpeechSessionFlow(mockDeps);

    expect(mockDeps.setResultText).toHaveBeenCalledWith("base");
    expect(mockDeps.applyResultText).toHaveBeenCalledWith("hello");
  });
});
