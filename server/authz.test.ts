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

describe("annotation ownership", () => {
  it("annotation.list throws NOT_FOUND for a screenshot the user doesn't own", async () => {
    vi.mocked(db.userOwnsScreenshot).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.annotation.list({ screenshotId: 3 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.getAnnotations).not.toHaveBeenCalled();
  });

  it("annotation.update throws NOT_FOUND for an annotation the user doesn't own", async () => {
    vi.mocked(db.userOwnsAnnotation).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.annotation.update({ id: 8, color: "#fff" })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.updateAnnotation).not.toHaveBeenCalled();
  });
});

describe("screenshot create/update guards", () => {
  it("screenshot.create throws NOT_FOUND for a foreign assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.screenshot.create({
      assessmentId: 42, viewType: "back", gaitPhase: "loading", imageUrl: "https://x/y.jpg",
    })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.createScreenshot).not.toHaveBeenCalled();
  });

  it("screenshot.update throws NOT_FOUND for a foreign screenshot", async () => {
    vi.mocked(db.userOwnsScreenshot).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.screenshot.update({ id: 9, description: "x" })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.updateScreenshot).not.toHaveBeenCalled();
  });
});

describe("dynamo & video ownership", () => {
  it("dynamo.list throws NOT_FOUND for a foreign assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.list({ assessmentId: 2 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.userOwnsAssessment).toHaveBeenCalledWith(2, 1);
    expect(db.getDynamoTests).not.toHaveBeenCalled();
  });

  it("dynamo.create throws NOT_FOUND for a foreign assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.create({ assessmentId: 2, joint: "Hip", movement: "Flexion" })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.createDynamoTest).not.toHaveBeenCalled();
  });

  it("dynamo.update throws NOT_FOUND for a foreign row", async () => {
    vi.mocked(db.userOwnsDynamoTest).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.update({ id: 4 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.userOwnsDynamoTest).toHaveBeenCalledWith(4, 1);
    expect(db.updateDynamoTest).not.toHaveBeenCalled();
  });

  it("dynamo.delete throws NOT_FOUND for a foreign row", async () => {
    vi.mocked(db.userOwnsDynamoTest).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.delete({ id: 4 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.deleteDynamoTest).not.toHaveBeenCalled();
  });

  it("video.list throws NOT_FOUND for a foreign assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.video.list({ assessmentId: 2 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.getVideos).not.toHaveBeenCalled();
  });

  it("video.delete throws NOT_FOUND for a foreign video", async () => {
    vi.mocked(db.userOwnsVideo).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.video.delete({ id: 6 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.userOwnsVideo).toHaveBeenCalledWith(6, 1);
    expect(db.deleteVideo).not.toHaveBeenCalled();
  });
});
