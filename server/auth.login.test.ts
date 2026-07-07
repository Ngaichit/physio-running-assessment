import { describe, expect, it, vi } from "vitest";

// passwordMatches only reads ENV (admin email/password) + bcrypt — no DB.
// Mock ENV as auth.ts imports it: from server/_core/auth.ts that specifier is
// "./env", which resolves to server/_core/env — the same module this test
// targets with the path relative to server/auth.login.test.ts.
vi.mock("./_core/env", () => ({ ENV: { adminEmail: "admin@clinic.com", adminPassword: "admin-secret" } }));

import { passwordMatches } from "./_core/auth";

describe("passwordMatches", () => {
  it("rejects a password-less non-admin account even with the admin password", async () => {
    const user = { email: "someone@else.com", passwordHash: null } as any;
    await expect(passwordMatches(user, "admin-secret")).resolves.toBe(false);
  });

  it("allows the admin email with the admin password when it has no hash", async () => {
    const user = { email: "admin@clinic.com", passwordHash: null } as any;
    await expect(passwordMatches(user, "admin-secret")).resolves.toBe(true);
  });

  it("rejects the admin email with a wrong admin password", async () => {
    const user = { email: "admin@clinic.com", passwordHash: null } as any;
    await expect(passwordMatches(user, "nope")).resolves.toBe(false);
  });
});
