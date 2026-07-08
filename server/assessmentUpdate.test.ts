import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
vi.mock("./db");
import * as db from "./db";
import { appRouter } from "./routers";

function authCtx() {
  return {
    user: {
      id: 1,
      openId: "u",
      email: "u@x.com",
      name: "U",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: null,
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  } as TrpcContext;
}

beforeEach(() => vi.resetAllMocks());

describe("assessment.update reportJson", () => {
  it("accepts a JSON string reportJson (mysql2 returns json columns as strings)", async () => {
    vi.mocked(db.updateAssessment).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.assessment.update({ id: 1, reportJson: JSON.stringify({ summary: "s" }) } as any)).resolves.not.toThrow();
    expect(db.updateAssessment).toHaveBeenCalled();
  });

  it("accepts an object reportJson", async () => {
    vi.mocked(db.updateAssessment).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.assessment.update({ id: 1, reportJson: { summary: "s", extra: 1 } } as any)).resolves.not.toThrow();
  });
});
