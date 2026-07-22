import { describe, expect, it } from "vitest";
import { containVideoRect } from "./videoFrameRect";

describe("containVideoRect", () => {
  it("letterboxes left/right when container is wider than the video", () => {
    // 200x100 container, 1:1 video → 100x100 centered
    expect(containVideoRect(200, 100, 100, 100)).toEqual({ left: 50, top: 0, width: 100, height: 100 });
  });
  it("letterboxes top/bottom when container is taller than the video", () => {
    // 100x200 container, 2:1 video → 100x50 centered vertically
    expect(containVideoRect(100, 200, 200, 100)).toEqual({ left: 0, top: 75, width: 100, height: 50 });
  });
  it("fills exactly when aspect ratios match", () => {
    expect(containVideoRect(300, 150, 200, 100)).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });
  it("returns a zero rect for degenerate inputs", () => {
    expect(containVideoRect(0, 100, 100, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(containVideoRect(100, 100, 0, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
