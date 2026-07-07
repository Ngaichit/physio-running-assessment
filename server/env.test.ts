import { describe, expect, it } from "vitest";
import { assertRequiredEnv } from "./_core/env";

describe("assertRequiredEnv", () => {
  it("throws when JWT_SECRET is empty in production", () => {
    expect(() => assertRequiredEnv({ JWT_SECRET: "", NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
  });
  it("does not throw when JWT_SECRET is present", () => {
    expect(() => assertRequiredEnv({ JWT_SECRET: "x".repeat(32), NODE_ENV: "production" })).not.toThrow();
  });
  it("does not throw in non-production even if empty", () => {
    expect(() => assertRequiredEnv({ JWT_SECRET: "", NODE_ENV: "development" })).not.toThrow();
  });
});
