import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zReportData, zReportLlmOutput } from "./reportSchema";

describe("zReportData", () => {
  it("accepts a full report", () => {
    const r = {
      background: "b",
      impressionFromTesting: "i",
      summary: "s",
      problems: [{ title: "t", description: "d", findings: ["f"] }],
      management: {
        runningCues: "",
        gaitRelearning: "g",
        mobilityExercises: "m",
        strengthExercises: "s",
        runningProgramming: "r",
      },
      metricsRatings: [
        {
          metricName: "Cadence",
          measuredValue: 160,
          unit: "spm",
          rating: "Low",
          notes: "n",
        },
      ],
      asymmetryData: [
        {
          metricName: "Hip drop",
          leftValue: 4,
          rightValue: 8,
          difference: 4,
          percentDiff: 50,
          rating: "mod",
        },
      ],
    };
    expect(zReportData.safeParse(r).success).toBe(true);
  });
  it("accepts a partial (manually-edited) report and preserves unknown keys", () => {
    const r = { summary: "only summary", somethingNew: 1 } as any;
    const parsed = zReportData.safeParse(r);
    expect(parsed.success).toBe(true);
    expect((parsed.data as any).somethingNew).toBe(1);
  });
  it("rejects a totally wrong type", () => {
    expect(zReportData.safeParse("not an object").success).toBe(false);
  });
  it("validates in the piped router form (z.unknown().pipe(...).nullable().optional())", () => {
    const piped = z.unknown().pipe(zReportData).nullable().optional();
    expect(piped.safeParse("nope").success).toBe(false);
    expect(piped.safeParse(null).success).toBe(true);
  });
});

describe("zReportLlmOutput", () => {
  it("requires the core generated fields", () => {
    expect(zReportLlmOutput.safeParse({ summary: "s" }).success).toBe(false);
  });
  it("accepts a complete LLM output", () => {
    const r = {
      background: "b",
      impressionFromTesting: "i",
      summary: "s",
      metricsAnalysis: "m",
      asymmetryAnalysis: "a",
      problems: [{ title: "t", description: "d", findings: ["f"] }],
      management: {
        gaitRelearning: "g",
        mobilityExercises: "m",
        strengthExercises: "s",
        runningProgramming: "r",
      },
    };
    expect(zReportLlmOutput.safeParse(r).success).toBe(true);
  });
});
