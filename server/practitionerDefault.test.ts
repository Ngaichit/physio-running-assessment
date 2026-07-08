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

describe("practitioner.getDefault", () => {
  it("resolves to null (not undefined) when no practitioner exists", async () => {
    vi.mocked(db.getDefaultPractitioner).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(authCtx(1));
    const result = await caller.practitioner.getDefault();
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
    expect(db.getDefaultPractitioner).toHaveBeenCalledWith(1);
  });
});
