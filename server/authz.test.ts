import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db");
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

beforeEach(() => vi.resetAllMocks());

describe("screenshot ownership", () => {
  it("screenshot.list throws NOT_FOUND when the assessment isn't the user's", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.screenshot.list({ assessmentId: 99 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.userOwnsAssessment).toHaveBeenCalledWith(99, 1);
    expect(db.getScreenshots).not.toHaveBeenCalled();
  });

  it("screenshot.list returns rows when the user owns the assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(true);
    vi.mocked(db.getScreenshots).mockResolvedValue([] as any);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.screenshot.list({ assessmentId: 5 })).resolves.toEqual([]);
    expect(db.getScreenshots).toHaveBeenCalledWith(5);
  });

  it("screenshot.delete throws NOT_FOUND when the screenshot isn't the user's", async () => {
    vi.mocked(db.userOwnsScreenshot).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.screenshot.delete({ id: 7 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.deleteScreenshot).not.toHaveBeenCalled();
  });
});
