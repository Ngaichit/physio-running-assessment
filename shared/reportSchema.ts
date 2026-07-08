/**
 * Canonical Zod schema for the AI report data (`reportJson`).
 *
 * This is the single source of truth that ends the previous 3-way drift between
 * the client `interface ReportData`, the hand-written LLM JSON schema, and the
 * unvalidated `reportJson: z.any()` server input.
 *
 * Two variants are exported:
 *  - `zReportData` — LENIENT. Every field is optional and unknown keys are
 *    preserved (`.loose()`), so it never rejects a legitimately stored report,
 *    including partial objects produced by manual client edits and forward-compat
 *    keys the app doesn't know about yet. Used to validate stored `reportJson`.
 *  - `zReportLlmOutput` — STRICTER. Requires the core fields the LLM must always
 *    generate. Used (in P2.2) to validate raw LLM output.
 *
 * Zod v4: `z.object({...}).loose()` allows and preserves unknown keys.
 */
import { z } from "zod";

/** A single metric rating row. Unknown keys preserved for forward-compat. */
export const zMetricRating = z
  .object({
    metricId: z.string().optional(),
    metricName: z.string(),
    measuredValue: z.number(),
    unit: z.string(),
    rating: z.string(),
    finding: z.string().optional(),
    loadShift: z.string().optional(),
    optimalRange: z.string().optional(),
    view: z.string().optional(),
    phase: z.string().optional(),
    notes: z.string(),
    leftValue: z.number().nullable().optional(),
    rightValue: z.number().nullable().optional(),
  })
  .loose();

/** A single left/right asymmetry comparison row. */
export const zAsymmetryItem = z
  .object({
    metricName: z.string(),
    leftValue: z.number().nullable(),
    rightValue: z.number().nullable(),
    difference: z.number().nullable(),
    percentDiff: z.number().nullable(),
    rating: z.string(),
    view: z.string().optional(),
  })
  .loose();

/** A single dynamometer test summary row. */
export const zDynamoTestSummary = z
  .object({
    id: z.number(),
    joint: z.string(),
    movement: z.string(),
    position: z.string().nullable(),
    leftValue: z.number().nullable(),
    rightValue: z.number().nullable(),
    unit: z.string(),
    asymmetryPercent: z.number().nullable(),
    notes: z.string().nullable(),
    leftPeakForce: z.number().nullable().optional(),
    rightPeakForce: z.number().nullable().optional(),
    peakForceUnit: z.string().nullable().optional(),
    leftPeakRfd: z.number().nullable().optional(),
    rightPeakRfd: z.number().nullable().optional(),
    peakRfdUnit: z.string().nullable().optional(),
    leftTimeToPeak: z.number().nullable().optional(),
    rightTimeToPeak: z.number().nullable().optional(),
  })
  .loose();

/** A single identified problem. */
const zProblem = z
  .object({
    title: z.string(),
    description: z.string(),
    findings: z.array(z.string()),
  })
  .loose();

/**
 * Full canonical report — LENIENT variant.
 * All fields optional; unknown keys preserved. Never rejects a stored report.
 */
export const zReportData = z
  .object({
    background: z.string().optional(),
    impressionFromTesting: z.string().optional(),
    problems: z.array(zProblem).optional(),
    management: z
      .object({
        runningCues: z.string().optional(),
        gaitRelearning: z.string().optional(),
        mobilityExercises: z.string().optional(),
        strengthExercises: z.string().optional(),
        runningProgramming: z.string().optional(),
      })
      .loose()
      .optional(),
    summary: z.string().optional(),
    metricsRatings: z.array(zMetricRating).optional(),
    metricsAnalysis: z.string().optional(),
    asymmetryAnalysis: z.string().optional(),
    asymmetryData: z.array(zAsymmetryItem).optional(),
    dynamoTests: z.array(zDynamoTestSummary).optional(),
  })
  .loose();

export type ReportData = z.infer<typeof zReportData>;

/**
 * STRICTER variant for validating raw LLM output (used in P2.2).
 * Requires the fields the model always generates. `management` requires its
 * exercise/programming sub-fields; `runningCues` stays optional because the
 * model does not always emit it.
 */
export const zReportLlmOutput = z
  .object({
    background: z.string(),
    impressionFromTesting: z.string(),
    problems: z.array(zProblem),
    management: z
      .object({
        runningCues: z.string().optional(),
        gaitRelearning: z.string(),
        mobilityExercises: z.string(),
        strengthExercises: z.string(),
        runningProgramming: z.string(),
      })
      .loose(),
    summary: z.string(),
    metricsAnalysis: z.string(),
    asymmetryAnalysis: z.string(),
  })
  .loose();

export type ReportLlmOutput = z.infer<typeof zReportLlmOutput>;
