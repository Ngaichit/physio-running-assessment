import { describe, expect, it } from "vitest";
import { calculateInnerAngle, getEffectiveAngle, type Point } from "./annotationGeometry";

const pts = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

describe("calculateInnerAngle", () => {
  it("returns 90° for a right angle", () => {
    // arm → vertex → arm; vertex at origin
    expect(calculateInnerAngle(pts([0, 1], [0, 0], [1, 0]))).toBeCloseTo(90, 6);
  });
  it("returns 180° for a straight line through the vertex", () => {
    expect(calculateInnerAngle(pts([-1, 0], [0, 0], [1, 0]))).toBeCloseTo(180, 6);
  });
  it("returns 45° for a diagonal arm", () => {
    expect(calculateInnerAngle(pts([1, 1], [0, 0], [1, 0]))).toBeCloseTo(45, 6);
  });
  it("returns 0 when fewer than 3 points", () => {
    expect(calculateInnerAngle(pts([0, 0], [1, 1]))).toBe(0);
  });
  it("returns 0 when an arm has zero length (degenerate)", () => {
    expect(calculateInnerAngle(pts([0, 0], [0, 0], [1, 0]))).toBe(0);
  });
});

describe("getEffectiveAngle", () => {
  const right = pts([0, 1], [0, 0], [1, 0]); // inner = 90
  it("returns the inner angle by default", () => {
    expect(getEffectiveAngle(right)).toBeCloseTo(90, 6);
  });
  it("returns 360 - inner for outer mode", () => {
    expect(getEffectiveAngle(right, "outer")).toBeCloseTo(270, 6);
  });
  it("returns |180 - inner| for supplement mode", () => {
    expect(getEffectiveAngle(right, "supplement")).toBeCloseTo(90, 6);
  });
});
