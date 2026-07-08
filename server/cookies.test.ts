import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

describe("getSessionCookieOptions", () => {
  it("uses sameSite lax + secure on an https request", () => {
    const opts = getSessionCookieOptions({ protocol: "https", headers: {} } as any);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
  });
  it("uses sameSite lax on a plain http request", () => {
    const opts = getSessionCookieOptions({ protocol: "http", headers: {} } as any);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(false);
  });
});
