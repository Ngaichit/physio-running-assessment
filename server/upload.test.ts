import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: "data:stub" })) }));
import { storagePut } from "./storage";
import { appRouter } from "./routers";

function authCtx(userId = 7): TrpcContext {
  return {
    user: { id: userId, openId: "u", email: "u@x.com", name: "U", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), passwordHash: null } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => vi.resetAllMocks());

describe("upload.uploadFile", () => {
  it("derives a user-scoped key and ignores any client-supplied path", async () => {
    const caller = appRouter.createCaller(authCtx(7));
    await caller.upload.uploadFile({ folder: "screenshots", fileName: "x.jpg", base64Data: Buffer.from("hi").toString("base64"), contentType: "image/jpeg" });
    const keyArg = vi.mocked(storagePut).mock.calls[0][0];
    expect(keyArg).toMatch(/^screenshots\/7\/[A-Za-z0-9_-]+\.jpg$/);
  });

  it("rejects a disallowed content type", async () => {
    const caller = appRouter.createCaller(authCtx(7));
    await expect(caller.upload.uploadFile({ folder: "screenshots", fileName: "x.html", base64Data: "AAAA", contentType: "text/html" })).rejects.toThrow(/unsupported file type/i);
  });

  it("rejects a file over the 15 MB cap", async () => {
    const caller = appRouter.createCaller(authCtx(7));
    // base64 of a >15MB buffer
    const big = Buffer.alloc(16 * 1024 * 1024).toString("base64");
    await expect(caller.upload.uploadFile({ folder: "inbody", fileName: "big.pdf", base64Data: big, contentType: "application/pdf" })).rejects.toThrow(/15 MB|limit/i);
  });

  it("rejects a disallowed folder", async () => {
    const caller = appRouter.createCaller(authCtx(7));
    await expect(caller.upload.uploadFile({ folder: "../etc", fileName: "x.jpg", base64Data: "AAAA", contentType: "image/jpeg" } as any)).rejects.toThrow();
  });
});
