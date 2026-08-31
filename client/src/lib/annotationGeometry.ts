export type Point = { x: number; y: number };
export type AnnotationType = "line" | "angle" | "circle" | "text" | "horizontal" | "vertical";
export type AngleMode = "inner" | "outer" | "supplement";

// Calculate inner angle between 3 points (always returns the smaller angle 0-180).
// Copied verbatim from AnnotationCanvas so both renderers agree.
export function calculateInnerAngle(points: Point[]): number {
  if (points.length < 3) return 0;
  const [p1, vertex, p2] = points;
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI;
}

// Effective angle for the chosen display mode.
export function getEffectiveAngle(points: Point[], mode: AngleMode = "inner"): number {
  const inner = calculateInnerAngle(points);
  if (mode === "outer") return 360 - inner;
  if (mode === "supplement") return Math.abs(180 - inner);
  return inner;
}

// The number to print for an angle annotation.
//
// `measuredValue` is authoritative: the annotator wrote it with the chosen mode
// AND the +/- direction already applied, and it is what the metrics table
// prints. The report used to recompute the angle with its own winding-aware
// formula (`if (cross < 0) inner = 360 - inner`), which `calculateInnerAngle`
// has no counterpart for — so whenever the three points happened to be clicked
// in the opposite order, inner and outer came out swapped and a 1.1 degree
// tibial inclination printed as 358.9. Recomputing is also how the pill on the
// photo came to disagree with the table row for the same annotation.
export function annotationDisplayAngle(
  measuredValue: number | null | undefined,
  points: Point[],
  mode: AngleMode = "inner",
  isNegative = false,
): number | null {
  if (measuredValue != null && Number.isFinite(measuredValue)) {
    return Math.round(measuredValue * 10) / 10;
  }
  if (points.length < 3) return null;
  const val = Math.round(getEffectiveAngle(points, mode) * 10) / 10;
  return isNegative ? -val : val;
}
