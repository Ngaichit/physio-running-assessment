import { describe, expect, it } from "vitest";
import {
  annotationDisplayAngle,
  calculateInnerAngle,
  getEffectiveAngle,
  type Point,
} from "./annotationGeometry";

const pts = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

// The same 90° corner at the origin, but with the two arms clicked in opposite
// order. Identical geometry, opposite cross-product sign — this is the shape
// that broke the printed report.
const CLOCKWISE = pts([1, 0], [0, 0], [0, 1]);
const COUNTER = pts([0, 1], [0, 0], [1, 0]);

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
  it("is unsigned — the order the points were clicked does not change it", () => {
    expect(calculateInnerAngle(CLOCKWISE)).toBeCloseTo(90, 6);
    expect(calculateInnerAngle(COUNTER)).toBeCloseTo(90, 6);
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

describe("annotationDisplayAngle", () => {
  it("prefers the stored measuredValue, which already has mode and sign applied", () => {
    // Geometry says 90; the annotator stored 38.4 for this annotation. The
    // stored number wins, because it is what the metrics table prints too.
    expect(annotationDisplayAngle(38.4, CLOCKWISE, "inner")).toBe(38.4);
  });

  it("keeps a negative stored value negative", () => {
    expect(annotationDisplayAngle(-11.3, CLOCKWISE, "inner")).toBe(-11.3);
  });

  it("rounds a stored value to one decimal", () => {
    expect(annotationDisplayAngle(38.44999, CLOCKWISE, "inner")).toBe(38.4);
  });

  it("keeps a stored zero rather than falling back to the geometry", () => {
    expect(annotationDisplayAngle(0, CLOCKWISE, "inner")).toBe(0);
  });

  it("falls back to the computed angle when nothing was stored", () => {
    expect(annotationDisplayAngle(null, CLOCKWISE, "inner")).toBe(90);
    expect(annotationDisplayAngle(undefined, CLOCKWISE, "outer")).toBe(270);
    expect(annotationDisplayAngle(null, CLOCKWISE, "supplement")).toBe(90);
  });

  it("applies isNegative to a fallback value", () => {
    expect(annotationDisplayAngle(null, CLOCKWISE, "inner", true)).toBe(-90);
  });

  it("ignores a non-finite stored value", () => {
    expect(annotationDisplayAngle(NaN, CLOCKWISE, "inner")).toBe(90);
  });

  it("returns null when there is nothing to show", () => {
    expect(annotationDisplayAngle(null, pts([0, 0]), "inner")).toBeNull();
  });

  // The regression. The report used to flip `inner` to its reflex value
  // whenever the cross product was negative, so these two identical corners
  // printed 90° and 270° depending only on the order the points were clicked —
  // "I picked the other angle but it shows the wrong one".
  it("gives the same reading whichever way round the points were clicked", () => {
    for (const mode of ["inner", "outer", "supplement"] as const) {
      expect(annotationDisplayAngle(null, CLOCKWISE, mode))
        .toBe(annotationDisplayAngle(null, COUNTER, mode));
    }
    expect(annotationDisplayAngle(null, COUNTER, "inner")).toBe(90);
    expect(annotationDisplayAngle(null, COUNTER, "outer")).toBe(270);
  });

  it("never reports a reflex angle for inner mode", () => {
    expect(annotationDisplayAngle(null, COUNTER, "inner")!).toBeLessThanOrEqual(180);
  });
});
