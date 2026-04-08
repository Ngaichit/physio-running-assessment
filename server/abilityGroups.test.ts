import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(userId = 1): TrpcContext {
  return {
    user: { id: userId, openId: "test-open-id", name: "Test User", email: "test@example.com", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), loginMethod: "password" },
    req: {} as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("Ability Groups", () => {
  it("seedDefaults creates 5 default ability groups", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Force seed defaults (in case groups already exist from previous test runs)
    const result = await caller.abilityGroup.seedDefaults({ force: true });
    expect(result.seeded).toBe(true);
    expect(result.message).toContain("5");

    // List should return 5 groups
    const groups = await caller.abilityGroup.list();
    expect(groups.length).toBe(5);

    // Verify group structure
    const shockAbsorption = groups.find((g: any) => g.groupId === "shock_absorption");
    expect(shockAbsorption).toBeDefined();
    expect(shockAbsorption!.label).toBe("Shock Absorption");
    expect(shockAbsorption!.color).toBe("#2874A6");
    expect((shockAbsorption!.metricIds as string[])).toEqual(["M02", "M03"]);

    const stability = groups.find((g: any) => g.groupId === "stability");
    expect(stability).toBeDefined();
    expect(stability!.label).toBe("Stability");

    const propulsion = groups.find((g: any) => g.groupId === "propulsion");
    expect(propulsion).toBeDefined();

    const alignment = groups.find((g: any) => g.groupId === "alignment");
    expect(alignment).toBeDefined();

    const efficiency = groups.find((g: any) => g.groupId === "efficiency");
    expect(efficiency).toBeDefined();
  });

  it("seedDefaults does not reseed when groups exist without force", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First seed
    await caller.abilityGroup.seedDefaults();

    // Second seed without force should not reseed
    const result = await caller.abilityGroup.seedDefaults();
    expect(result.seeded).toBe(false);
    expect(result.message).toContain("already exist");
  });

  it("seedDefaults with force reseeds groups", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First seed
    await caller.abilityGroup.seedDefaults();

    // Force reseed
    const result = await caller.abilityGroup.seedDefaults({ force: true });
    expect(result.seeded).toBe(true);

    const groups = await caller.abilityGroup.list();
    expect(groups.length).toBe(5);
  });

  it("create adds a new ability group", async () => {
    const ctx = createAuthContext(2);
    const caller = appRouter.createCaller(ctx);

    const newGroup = await caller.abilityGroup.create({
      groupId: "custom_group",
      label: "Custom Group",
      color: "#FF5733",
      metricIds: ["M01", "M02"],
      sortOrder: 1,
    });

    expect(newGroup).toBeDefined();
    expect(newGroup.groupId).toBe("custom_group");
    expect(newGroup.label).toBe("Custom Group");
    expect(newGroup.color).toBe("#FF5733");
    expect((newGroup.metricIds as string[])).toEqual(["M01", "M02"]);
  });

  it("update modifies an existing ability group", async () => {
    const ctx = createAuthContext(3);
    const caller = appRouter.createCaller(ctx);

    // Create a group
    const created = await caller.abilityGroup.create({
      groupId: "test_update",
      label: "Test Update",
      color: "#000000",
      metricIds: ["M01"],
      sortOrder: 1,
    });

    // Update it
    await caller.abilityGroup.update({
      id: created.id,
      label: "Updated Label",
      color: "#FFFFFF",
      metricIds: ["M01", "M03", "M05"],
    });

    // Verify
    const groups = await caller.abilityGroup.list();
    const updated = groups.find((g: any) => g.id === created.id);
    expect(updated).toBeDefined();
    expect(updated!.label).toBe("Updated Label");
    expect(updated!.color).toBe("#FFFFFF");
    expect((updated!.metricIds as string[])).toEqual(["M01", "M03", "M05"]);
  });

  it("delete removes an ability group", async () => {
    const ctx = createAuthContext(4);
    const caller = appRouter.createCaller(ctx);

    // Create a group
    const created = await caller.abilityGroup.create({
      groupId: "test_delete",
      label: "Test Delete",
      color: "#000000",
      metricIds: ["M01"],
      sortOrder: 1,
    });

    // Delete it
    await caller.abilityGroup.delete({ id: created.id });

    // Verify it's gone
    const groups = await caller.abilityGroup.list();
    const found = groups.find((g: any) => g.id === created.id);
    expect(found).toBeUndefined();
  });

  it("create with metricWeights stores weights", async () => {
    const ctx = createAuthContext(6);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.abilityGroup.create({
      groupId: "weighted_group",
      label: "Weighted Group",
      color: "#FF0000",
      metricIds: ["M01", "M02", "M03"],
      metricWeights: { M01: 1.5, M02: 0.8, M03: 2.0 },
      sortOrder: 1,
    });

    expect(created).toBeDefined();
    const groups = await caller.abilityGroup.list();
    const found = groups.find((g: any) => g.id === created.id);
    expect(found).toBeDefined();
    const weights = found!.metricWeights as Record<string, number>;
    expect(weights.M01).toBe(1.5);
    expect(weights.M02).toBe(0.8);
    expect(weights.M03).toBe(2.0);
  });

  it("update modifies metricWeights", async () => {
    const ctx = createAuthContext(7);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.abilityGroup.create({
      groupId: "weight_update",
      label: "Weight Update",
      color: "#00FF00",
      metricIds: ["M01", "M02"],
      metricWeights: { M01: 1.0, M02: 1.0 },
      sortOrder: 1,
    });

    await caller.abilityGroup.update({
      id: created.id,
      metricWeights: { M01: 2.5, M02: 0.5 },
    });

    const groups = await caller.abilityGroup.list();
    const updated = groups.find((g: any) => g.id === created.id);
    const weights = updated!.metricWeights as Record<string, number>;
    expect(weights.M01).toBe(2.5);
    expect(weights.M02).toBe(0.5);
  });

  it("reset replaces all groups with defaults", async () => {
    const ctx = createAuthContext(5);
    const caller = appRouter.createCaller(ctx);

    // Create a custom group
    await caller.abilityGroup.create({
      groupId: "custom",
      label: "Custom",
      color: "#000000",
      metricIds: ["M01"],
      sortOrder: 1,
    });

    // Reset to defaults
    const resetResult = await caller.abilityGroup.reset();
    expect(resetResult.length).toBe(5);

    // Verify custom group is gone and defaults are present
    const groups = await caller.abilityGroup.list();
    expect(groups.length).toBe(5);
    const custom = groups.find((g: any) => g.groupId === "custom");
    expect(custom).toBeUndefined();
  });
});
