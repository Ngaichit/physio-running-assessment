import { describe, it, expect } from "vitest";
import { videoKeyAction, isTextEntryTarget } from "./videoKeys";

describe("videoKeyAction", () => {
  it("maps space to play/pause", () => {
    expect(videoKeyAction(" ")).toBe("toggle-play");
    expect(videoKeyAction("Spacebar")).toBe("toggle-play");
  });

  it("maps left/right arrows to frame stepping", () => {
    expect(videoKeyAction("ArrowLeft")).toBe("step-back");
    expect(videoKeyAction("ArrowRight")).toBe("step-forward");
  });

  it("ignores keys the video does not own", () => {
    for (const key of ["a", "Enter", "Escape", "ArrowUp", "ArrowDown", "Tab", "k"]) {
      expect(videoKeyAction(key)).toBeNull();
    }
  });
});

describe("isTextEntryTarget", () => {
  it("treats text controls as text entry", () => {
    expect(isTextEntryTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "SELECT" })).toBe(true);
  });

  it("is case-insensitive about tag names", () => {
    expect(isTextEntryTarget({ tagName: "input" })).toBe(true);
  });

  it("treats contenteditable as text entry", () => {
    expect(isTextEntryTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  // Everything else must fall through so playback keys keep working — the
  // canvas and the toolbar buttons included.
  it("does not treat the canvas or buttons as text entry", () => {
    expect(isTextEntryTarget({ tagName: "CANVAS" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "DIV" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "BODY" })).toBe(false);
  });

  it("handles a missing target", () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget({})).toBe(false);
  });
});
