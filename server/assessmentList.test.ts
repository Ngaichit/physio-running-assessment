import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock the db layer so we can assert the router wires assessment.list through
// to getAssessments and returns the (projected) rows unchanged.
vi.mock("./db", () => ({
  getAssessments: vi.fn(),
}));

import { appRouter } from "./routers";
import * as db from "./db";

function createAuthContext(): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user-001",
    email: "physio@example.com",
    name: "Test Physio",
    loginMethod: "manus",
    role: "user",
    passwordHash: "$2a$10$fakehashfakehashfakehashfake" as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as NonNullable<TrpcContext["user"]>;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("assessment.list projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the projected (blob-free) row shape from getAssessments", async () => {
    const projectedRow = {
      id: 7,
      userId: 1,
      patientId: 42,
      assessmentDate: "2025-01-01",
      status: "draft" as const,
      practitionerId: null,
      followUpMonths: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.getAssessments).mockResolvedValue([projectedRow] as any);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.assessment.list({ patientId: 42 });

    expect(db.getAssessments).toHaveBeenCalledWith(42, 1);
    expect(result).toEqual([projectedRow]);
    // Guard: no blob columns leak into the list payload.
    expect(result[0]).not.toHaveProperty("reportJson");
    expect(result[0]).not.toHaveProperty("inbodyFileUrl");
    expect(result[0]).not.toHaveProperty("vo2FileUrl");
  });
});
