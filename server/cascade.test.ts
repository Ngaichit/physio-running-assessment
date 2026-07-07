import { describe, expect, it, vi } from "vitest";

// Records which tables .delete() was called on, in order. Defined via vi.hoisted
// so the (hoisted) vi.mock factory below can reference it.
const { deleted, makeDb } = vi.hoisted(() => {
  const deleted: string[] = [];
  const rowsResult = (t: any) => {
    // A thenable (awaitable directly) that ALSO supports .limit()/.orderBy() chaining.
    const p: any = Promise.resolve(t.__rows ?? []);
    p.limit = () => Promise.resolve(t.__rows ?? []);
    p.orderBy = () => Promise.resolve(t.__rows ?? []);
    return p;
  };
  function makeDb() {
    const recorder: any = {
      select: () => ({ from: (t: any) => ({ where: () => rowsResult(t) }) }),
      delete: (t: any) => ({ where: () => { deleted.push(t.__name); return Promise.resolve(); } }),
      // transaction runs the callback with the same recording handle (tx === db),
      // so ordered deletes through the tx path are captured in `deleted`.
      transaction: async (cb: any) => cb(recorder),
    };
    return recorder;
  }
  return { deleted, makeDb };
});

// getDb() builds a real drizzle() instance from DATABASE_URL; mock the constructor
// so it returns our recording fake instead. (Intercepting the module-internal
// getDb() call directly via vi.spyOn does not work under ESM live bindings.)
process.env.DATABASE_URL = "mysql://mock";
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => makeDb() }));
vi.mock("./_core/env", () => ({ ENV: { adminEmail: "" } }));
vi.mock("drizzle-orm", () => ({ eq: () => ({}), and: () => ({}), desc: () => ({}) }));
vi.mock("../drizzle/schema", () => {
  const tag = (name: string, rows: any[] = []) => ({ __name: name, __rows: rows, id: {}, assessmentId: {}, patientId: {}, userId: {}, screenshotId: {}, sortOrder: {} });
  return {
    users: tag("users"), patients: tag("patients", [{ id: 1 }]),
    assessments: tag("assessments", [{ id: 11 }, { id: 12 }]),
    screenshots: tag("screenshots", [{ id: 101 }]),
    annotations: tag("annotations"), metricsStandards: tag("metricsStandards"),
    videos: tag("videos"), dynamoTests: tag("dynamoTests"), practitioners: tag("practitioners"),
  };
});

describe("deleteAssessment cascade", () => {
  it("deletes annotations, screenshots, dynamo, videos, then the assessment", async () => {
    deleted.length = 0;
    const db = await import("./db");
    await db.deleteAssessment(11, 1);
    expect(deleted).toContain("annotations");
    expect(deleted).toContain("screenshots");
    expect(deleted).toContain("dynamoTests");
    expect(deleted).toContain("videos");
    expect(deleted).toContain("assessments");
    // Annotations must be removed before their parent screenshots.
    expect(deleted.indexOf("annotations")).toBeLessThan(deleted.indexOf("screenshots"));
    // The assessment row itself must be deleted LAST (after all children).
    expect(deleted.indexOf("assessments")).toBe(deleted.length - 1);
  });
});

describe("deletePatient cascade", () => {
  it("cascades through every assessment, deleting the patient row last", async () => {
    deleted.length = 0;
    const db = await import("./db");
    await db.deletePatient(1, 1);
    // Both assessments (11 and 12) should be cascaded → two assessment deletes.
    expect(deleted.filter((t) => t === "assessments").length).toBe(2);
    expect(deleted).toContain("screenshots");
    expect(deleted).toContain("dynamoTests");
    expect(deleted).toContain("videos");
    expect(deleted).toContain("patients");
    // Patient row must be the very last delete, after every assessment.
    expect(deleted.indexOf("patients")).toBe(deleted.length - 1);
    expect(deleted.lastIndexOf("assessments")).toBeLessThan(deleted.indexOf("patients"));
  });
});
