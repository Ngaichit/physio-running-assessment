import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock the LLM so the report flow never touches the real Anthropic API,
// and the db so no real database is required.
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./db");

import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { appRouter } from "./routers";

type AuthedUser = NonNullable<TrpcContext["user"]>;

function authCtx(userId = 1): TrpcContext {
  const user: AuthedUser = {
    id: userId, openId: `u${userId}`, email: `u${userId}@x.com`, name: "U",
    loginMethod: "password", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    passwordHash: null,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// A complete, schema-valid LLM report (passes zReportLlmOutput).
const VALID_REPORT = {
  background: "Runner background prose.",
  impressionFromTesting: "Impression prose.",
  summary: "Summary.",
  metricsAnalysis: "metric line 1\nmetric line 2",
  asymmetryAnalysis: "asym line 1\nasym line 2",
  problems: [{ title: "Reduced Shock Absorption", description: "Short clinical sentence.", findings: ["Overstride 15° -> Braking ↑"] }],
  management: { gaitRelearning: "Cadence drill", mobilityExercises: "Calf stretch", strengthExercises: "Calf raise 3x15", runningProgramming: "Easy run 30 min" },
};

/** Shape an invokeLLM result the way the handler expects (OpenAI-ish). */
function llmResult(content: string) {
  return { choices: [{ message: { content } }] } as any;
}

function primeDbForReportFlow() {
  vi.mocked(db.getAssessment).mockResolvedValue({ id: 5, patientId: 3, assessmentDate: "2026-01-01" } as any);
  vi.mocked(db.getPatient).mockResolvedValue({ id: 3, name: "Jane Doe" } as any);
  vi.mocked(db.getScreenshots).mockResolvedValue([] as any);
  vi.mocked(db.getAnnotations).mockResolvedValue([] as any);
  vi.mocked(db.getDynamoTests).mockResolvedValue([] as any);
  vi.mocked(db.getMetricsStandards).mockResolvedValue([] as any);
  vi.mocked(db.updateAssessment).mockResolvedValue(undefined as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  primeDbForReportFlow();
});

describe("ai.generateReport — validation + retry", () => {
  it("valid report on first attempt: stores it and returns { report }", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(llmResult(JSON.stringify(VALID_REPORT)));

    const caller = appRouter.createCaller(authCtx(1));
    const res = await caller.ai.generateReport({ assessmentId: 5 });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(res.report.background).toBe(VALID_REPORT.background);
    expect(res.report.summary).toBe(VALID_REPORT.summary);

    expect(db.updateAssessment).toHaveBeenCalledTimes(1);
    const [, , data] = vi.mocked(db.updateAssessment).mock.calls[0];
    expect((data as any).reportJson.background).toBe(VALID_REPORT.background);
    expect((data as any).reportJson.summary).toBe(VALID_REPORT.summary);
  });

  it("invalid JSON on first attempt, valid on second: succeeds (invokeLLM called twice)", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(llmResult("this is not json at all"))
      .mockResolvedValueOnce(llmResult(JSON.stringify(VALID_REPORT)));

    const caller = appRouter.createCaller(authCtx(1));
    const res = await caller.ai.generateReport({ assessmentId: 5 });

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(res.report.summary).toBe(VALID_REPORT.summary);
    expect(db.updateAssessment).toHaveBeenCalledTimes(1);
  });

  it("schema-invalid output on both attempts: rejects and does NOT store", async () => {
    // Parseable JSON but missing required fields → zReportLlmOutput fails both times.
    vi.mocked(invokeLLM).mockResolvedValue(llmResult(JSON.stringify({ summary: "only summary" })));

    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.ai.generateReport({ assessmentId: 5 })).rejects.toThrow(/invalid report after two attempts/i);

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(db.updateAssessment).not.toHaveBeenCalled();
  });
});
