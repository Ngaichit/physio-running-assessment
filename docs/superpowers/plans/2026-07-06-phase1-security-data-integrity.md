# Phase 1 — Security & Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the live cross-tenant data exposure, stop HTML/SVG injection in the report, harden login/session, lock down the upload and PDF-fetch paths, and make deletes cascade — shipped as one standalone PR ahead of the other phases.

**Architecture:** Ownership is enforced with boolean `userOwns*` helpers in `server/db.ts` (joins up to `assessments.userId`) called from tRPC procedures, which throw `TRPCError({ code: "NOT_FOUND" })` on a miss — the DB layer stays free of tRPC types. Report HTML is escaped through a new pure `client/src/report/escape.ts`. Uploads derive their storage key server-side (no attacker-controlled key). Deletes cascade in application code (no schema migration, so rollout is a plain redeploy).

**Tech Stack:** Express + tRPC + Drizzle/MySQL (server), Vite+React (client), Vitest, pnpm. New deps: `helmet`, `express-rate-limit`.

**Source spec:** `docs/superpowers/specs/2026-07-06-app-audit-remediation-design.md` (Phase 1).

**Conventions:**
- Package manager is **pnpm**. Test: `pnpm test`. Typecheck: `pnpm check`. Build: `pnpm build`.
- Server tests live beside code as `server/*.test.ts`, run under Vitest, and use `appRouter.createCaller(ctx)` with `createAuthContext()`/`createUnauthContext()` helpers (see `server/features.test.ts:8-41`). Vitest runs with **no DATABASE_URL**, so `getDb()` returns `null`; DB-dependent behavior is tested by **mocking the `./db` module with `vi.mock`**, not by hitting a real database.
- Commit after every task with the shown message.

---

## Task 1: HTML/SVG escaping in the report

**Files:**
- Create: `client/src/report/escape.ts`
- Create: `client/src/report/escape.test.ts`
- Modify: `client/src/components/ReportPreview.tsx` (helpers `bulletListHtml` ~55-62, `generateAsymmetryChartSVG` ~357-420, and the print template inside `handleExportPDF`)

- [ ] **Step 1: Write the failing test**

Create `client/src/report/escape.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;"
    );
  });

  it("coerces non-strings and nullish to a safe string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });

  it("neutralizes an SVG-breaking payload", () => {
    expect(escapeHtml("</text><image href=x onerror=alert(1)>")).toBe(
      "&lt;/text&gt;&lt;image href=x onerror=alert(1)&gt;"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test escape`
Expected: FAIL — `Cannot find module './escape'`.

- [ ] **Step 3: Create the implementation**

Create `client/src/report/escape.ts`:

```ts
// Escape a value for safe interpolation into an HTML or SVG string.
// Used only on the string-building (print / dangerouslySetInnerHTML) paths —
// never on the React render path, which already escapes.
export function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test escape`
Expected: PASS (3 tests).

- [ ] **Step 5: Escape the SVG chart text**

In `client/src/components/ReportPreview.tsx`, add the import after the existing imports (near line 11):

```ts
import { escapeHtml } from "@/report/escape";
```

In `generateAsymmetryChartSVG`, the metric label is interpolated raw into `<text>`. Find:

```ts
    const metricLabel = a.metricName.length > 22 ? a.metricName.substring(0, 21) + '…' : a.metricName;
    out += `<text x="10" y="${y + rowH / 2}" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.navy}" font-weight="600">${metricLabel}</text>`;
```

Replace the second line's `${metricLabel}` with `${escapeHtml(metricLabel)}`:

```ts
    const metricLabel = a.metricName.length > 22 ? a.metricName.substring(0, 21) + '…' : a.metricName;
    out += `<text x="10" y="${y + rowH / 2}" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.navy}" font-weight="600">${escapeHtml(metricLabel)}</text>`;
```

- [ ] **Step 6: Escape the bullet-list HTML items**

Find `bulletListHtml` (~line 55-62) and escape each item. Replace:

```ts
  return `<ul style="margin:10px 2px 0;padding-left:18px;font-size:10.5px;color:#333;line-height:1.55;list-style-type:disc">${items.map(i => `<li style="margin:2px 0">${i}</li>`).join("")}</ul>`;
```

with:

```ts
  return `<ul style="margin:10px 2px 0;padding-left:18px;font-size:10.5px;color:#333;line-height:1.55;list-style-type:disc">${items.map(i => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join("")}</ul>`;
```

- [ ] **Step 7: Add escaped-text helpers inside `handleExportPDF`**

In `handleExportPDF`, immediately after `const patientName = patient ? patient.name : 'Unknown';`, add two local helpers used only by the template:

```ts
      // String-path escaping: escape() for plain values, escText() for AI text
      // that first flows through asText(). Used ONLY in the document.write template.
      const esc = escapeHtml;
      const escText = (v: unknown) => escapeHtml(asText(v));
```

- [ ] **Step 8: Escape every dynamic interpolation in the print template**

Apply these exact find→replace edits within the template string in `handleExportPDF` (each `old` is unique enough to anchor):

1. Title:
   - old: `<title>Running Assessment Report - ${patientName}</title>`
   - new: `<title>Running Assessment Report - ${esc(patientName)}</title>`
2. Cover patient name and footer name — replace the two standalone `${patientName}` occurrences that remain in the cover block and page-footer `<span>${patientName}</span>` with `${esc(patientName)}`. (There are three total including the title; after edit #1 the remaining two both become `${esc(patientName)}`.)
3. Screenshot description — old: `${ss.description ? ': ' + ss.description : ''}` → new: `${ss.description ? ': ' + esc(ss.description) : ''}`
4. Background — old: `${asText(displayReport.background)}` → new: `${escText(displayReport.background)}`
5. Impression — old: `${asText(displayReport.impressionFromTesting)}` → new: `${escText(displayReport.impressionFromTesting)}`
6. Summary — old: `${asText(displayReport.summary)}` → new: `${escText(displayReport.summary)}`
7. Problems — for the problems `.map`, wrap `p.title`, `p.description`, and each finding: `${esc(p.title)}`, `${esc(p.description)}`, and findings `${f.map(...)}` items as `${esc(finding)}`. (Match the existing `${p.title}`, `${p.description}`, and the findings map; add `esc(...)` around the interpolated value.)
8. Practitioner sign-off block — wrap each of `reportPractitioner.name`, `.title`, `.qualifications`, `.clinic`, `.phone`, `.email`, `.website`, `.address` interpolations with `esc(...)` (8 sites in the sign-off `<div>` near the end of the template).
9. Metrics table — wrap `${r.metricName}`, `${r.finding ...}`, `${r.notes ...}`, and any `optimalRange` interpolation with `esc(...)`.
10. Dynamo table — wrap `${d.joint}`, `${d.movement}`, `${d.position ...}`, `${d.notes ...}` interpolations with `esc(...)`.

> Guidance: search the template for `${` and confirm every interpolation of a value that originates from `patient`, `practitioner`, `displayReport` (AI), `ss` (screenshot), `r` (metric), `d` (dynamo), or `p`/`f` (problems/findings) is wrapped in `esc(...)` or `escText(...)`. Numeric-only values (`leftValue`, angles, percentages) and internal `BRAND.*` colors do NOT need escaping.

- [ ] **Step 9: Typecheck and build**

Run: `pnpm check && pnpm build`
Expected: both succeed, no TypeScript errors.

- [ ] **Step 10: Manual smoke test of escaping**

Run: `pnpm test escape` (PASS) and visually confirm no `${...}` interpolation of a name/AI/description value remains unescaped by grepping:
`grep -nE '\$\{(patientName|asText\(|ss\.description|p\.title|p\.description|reportPractitioner\.)' client/src/components/ReportPreview.tsx`
Expected: the only matches are inside `esc(...)`/`escText(...)` wrappers.

- [ ] **Step 11: Commit**

```bash
git add client/src/report/escape.ts client/src/report/escape.test.ts client/src/components/ReportPreview.tsx
git commit -m "Escape patient/AI/practitioner text in report HTML and SVG"
```

---

## Task 2: Ownership helpers + screenshot procedures

**Files:**
- Modify: `server/db.ts` (add `userOwnsAssessment`, `userOwnsScreenshot`, `userOwnsAnnotation`)
- Modify: `server/routers.ts` (screenshot router, ~104-128)
- Create: `server/authz.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/authz.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test authz`
Expected: FAIL — `db.userOwnsAssessment is not a function` (helpers don't exist yet).

- [ ] **Step 3: Add ownership helpers to `server/db.ts`**

Add these exports (place after `getAssessment`, ~line 115). Note the schema import already includes `screenshots`, `annotations`, `assessments`:

```ts
// ===== OWNERSHIP CHECKS (multi-tenant guards) =====
export async function userOwnsAssessment(assessmentId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: assessments.id }).from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function userOwnsScreenshot(screenshotId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: screenshots.id }).from(screenshots)
    .innerJoin(assessments, eq(screenshots.assessmentId, assessments.id))
    .where(and(eq(screenshots.id, screenshotId), eq(assessments.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function userOwnsAnnotation(annotationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: annotations.id }).from(annotations)
    .innerJoin(screenshots, eq(annotations.screenshotId, screenshots.id))
    .innerJoin(assessments, eq(screenshots.assessmentId, assessments.id))
    .where(and(eq(annotations.id, annotationId), eq(assessments.userId, userId))).limit(1);
  return rows.length > 0;
}
```

- [ ] **Step 4: Add the `TRPCError` import to `server/routers.ts`**

At the top of `server/routers.ts`, change:

```ts
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
```

to also import `TRPCError`:

```ts
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
```

- [ ] **Step 5: Guard the screenshot procedures**

Replace the entire `screenshot: router({...})` block (~104-128) with:

```ts
  screenshot: router({
    list: protectedProcedure.input(z.object({ assessmentId: z.number() })).query(async ({ ctx, input }) => {
      if (!(await db.userOwnsAssessment(input.assessmentId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getScreenshots(input.assessmentId);
    }),
    create: protectedProcedure.input(z.object({
      assessmentId: z.number(),
      viewType: z.enum(["side_left", "side_right", "back"]),
      gaitPhase: z.enum(["foot_strike", "loading", "mid_stance", "push_off", "swing", "other"]),
      imageUrl: z.string(),
      thumbnailUrl: z.string().optional(),
      timestamp: z.number().optional(),
      description: z.string().optional(),
      legSide: z.string().optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsAssessment(input.assessmentId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.createScreenshot(input);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      description: z.string().optional(),
      gaitPhase: z.enum(["foot_strike", "loading", "push_off", "swing", "other"]).optional(),
      legSide: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsScreenshot(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...data } = input;
      return db.updateScreenshot(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsScreenshot(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.deleteScreenshot(input.id);
    }),
  }),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test authz`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add server/db.ts server/routers.ts server/authz.test.ts
git commit -m "Enforce assessment/screenshot ownership on screenshot procedures"
```

---

## Task 3: Annotation procedures ownership

**Files:**
- Modify: `server/routers.ts` (annotation router, ~130-155)
- Modify: `server/authz.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe("screenshot ownership")` file a new block:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test authz`
Expected: FAIL — annotation procedures don't guard yet, so `getAnnotations`/`updateAnnotation` get called (or no throw).

- [ ] **Step 3: Guard the annotation procedures**

Replace the `annotation: router({...})` block with:

```ts
  annotation: router({
    list: protectedProcedure.input(z.object({ screenshotId: z.number() })).query(async ({ ctx, input }) => {
      if (!(await db.userOwnsScreenshot(input.screenshotId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getAnnotations(input.screenshotId);
    }),
    create: protectedProcedure.input(z.object({
      screenshotId: z.number(),
      annotationType: z.enum(["line", "angle", "circle", "text"]),
      data: z.any(),
      color: z.string().optional(),
      label: z.string().optional(),
      metricName: z.string().optional(),
      measuredValue: z.number().optional(),
      useOuterAngle: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsScreenshot(input.screenshotId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.createAnnotation(input);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      data: z.any().optional(),
      color: z.string().optional(),
      label: z.string().optional(),
      metricName: z.string().optional(),
      measuredValue: z.number().optional(),
      useOuterAngle: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsAnnotation(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...data } = input;
      return db.updateAnnotation(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsAnnotation(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.deleteAnnotation(input.id);
    }),
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test authz`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/authz.test.ts
git commit -m "Enforce screenshot/annotation ownership on annotation procedures"
```

---

## Task 4: Dynamo & video procedures ownership

**Files:**
- Modify: `server/db.ts` (add `userOwnsDynamoTest`, `userOwnsVideo`)
- Modify: `server/routers.ts` (dynamo router ~240-288, video router ~290-293)
- Modify: `server/authz.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/authz.test.ts`:

```ts
describe("dynamo & video ownership", () => {
  it("dynamo.list throws NOT_FOUND for a foreign assessment", async () => {
    vi.mocked(db.userOwnsAssessment).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.list({ assessmentId: 2 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.getDynamoTests).not.toHaveBeenCalled();
  });

  it("dynamo.update throws NOT_FOUND for a foreign row", async () => {
    vi.mocked(db.userOwnsDynamoTest).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.dynamo.update({ id: 4 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.updateDynamoTest).not.toHaveBeenCalled();
  });

  it("video.delete throws NOT_FOUND for a foreign video", async () => {
    vi.mocked(db.userOwnsVideo).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.video.delete({ id: 6 })).rejects.toThrow(/NOT_FOUND|not found/i);
    expect(db.deleteVideo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test authz`
Expected: FAIL — `db.userOwnsDynamoTest`/`db.userOwnsVideo` not a function.

- [ ] **Step 3: Add the DB helpers**

Add to `server/db.ts` (after `userOwnsAnnotation`). `dynamoTests` and `videos` are already imported:

```ts
export async function userOwnsDynamoTest(dynamoTestId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: dynamoTests.id }).from(dynamoTests)
    .innerJoin(assessments, eq(dynamoTests.assessmentId, assessments.id))
    .where(and(eq(dynamoTests.id, dynamoTestId), eq(assessments.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function userOwnsVideo(videoId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: videos.id }).from(videos)
    .innerJoin(assessments, eq(videos.assessmentId, assessments.id))
    .where(and(eq(videos.id, videoId), eq(assessments.userId, userId))).limit(1);
  return rows.length > 0;
}
```

- [ ] **Step 4: Guard the dynamo procedures**

In the `dynamo: router({...})` block, add the guard as the first line of each handler:
- `list`: before `return db.getDynamoTests(...)`, add
  `if (!(await db.userOwnsAssessment(input.assessmentId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });`
  and change the handler to `async ({ ctx, input })`.
- `create`: change to `async ({ ctx, input })` and add
  `if (!(await db.userOwnsAssessment(input.assessmentId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });`
  before `return db.createDynamoTest(input);`.
- `update`: change to `async ({ ctx, input })` and add
  `if (!(await db.userOwnsDynamoTest(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });`
  before `const { id, ...data } = input;`.
- `delete`: change to `async ({ ctx, input })` and add
  `if (!(await db.userOwnsDynamoTest(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });`
  before `return db.deleteDynamoTest(input.id);`.

- [ ] **Step 5: Guard the video procedures**

Replace the `video: router({...})` block with:

```ts
  video: router({
    list: protectedProcedure.input(z.object({ assessmentId: z.number() })).query(async ({ ctx, input }) => {
      if (!(await db.userOwnsAssessment(input.assessmentId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.getVideos(input.assessmentId);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsVideo(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      return db.deleteVideo(input.id);
    }),
  }),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test authz`
Expected: PASS (8 tests total).

- [ ] **Step 7: Commit**

```bash
git add server/db.ts server/routers.ts server/authz.test.ts
git commit -m "Enforce ownership on dynamo and video procedures"
```

---

## Task 5: `ai.analyzePose` ownership

**Files:**
- Modify: `server/routers.ts` (`ai.analyzePose`, ~421-426)
- Modify: `server/authz.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/authz.test.ts`:

```ts
describe("ai.analyzePose ownership", () => {
  it("throws NOT_FOUND when the screenshot isn't the user's", async () => {
    vi.mocked(db.userOwnsScreenshot).mockResolvedValue(false);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.ai.analyzePose({
      screenshotId: 10, imageUrl: "data:image/jpeg;base64,AAAA",
      viewType: "side_left", gaitPhase: "foot_strike",
    })).rejects.toThrow(/NOT_FOUND|not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test authz`
Expected: FAIL — `analyzePose` currently proceeds to build a prompt / call the LLM instead of throwing.

- [ ] **Step 3: Add the guard**

In `ai.analyzePose`, make the handler the first statement guard. Find the mutation handler opening:

```ts
    })).mutation(async ({ ctx, input }) => {
      // Determine which metrics to detect based on view type and gait phase
      const allMetrics = getMetricsForView(input.viewType, input.gaitPhase);
```

Insert the ownership check as the first line inside the handler:

```ts
    })).mutation(async ({ ctx, input }) => {
      if (!(await db.userOwnsScreenshot(input.screenshotId, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND" });
      // Determine which metrics to detect based on view type and gait phase
      const allMetrics = getMetricsForView(input.viewType, input.gaitPhase);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test authz`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/authz.test.ts
git commit -m "Enforce screenshot ownership on ai.analyzePose"
```

---

## Task 6: Cascade deletes for patients and assessments

**Files:**
- Modify: `server/db.ts` (`deletePatient` ~97-101, `deleteAssessment` ~130-134; add `deleteAssessmentCascade` helper)
- Create: `server/cascade.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/cascade.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// Build a chainable drizzle-like mock. Terminal calls resolve; the whole
// chain records which tables were deleted via the `where` table tag.
const deleted: string[] = [];
function makeDb() {
  return {
    select: () => ({ from: (t: any) => ({ where: () => ({ orderBy: () => Promise.resolve(t.__rows ?? []), limit: () => Promise.resolve(t.__rows ?? []) }) }) }),
    delete: (t: any) => ({ where: () => { deleted.push(t.__name); return Promise.resolve(); } }),
  };
}

vi.mock("./_core/env", () => ({ ENV: { adminEmail: "" } }));
vi.mock("drizzle-orm", () => ({ eq: () => ({}), and: () => ({}), desc: () => ({}) }));

// Tag the schema tables so the mock can name them.
vi.mock("../drizzle/schema", () => {
  const tag = (name: string, rows: any[] = []) => ({ __name: name, __rows: rows, id: {}, assessmentId: {}, patientId: {}, userId: {}, screenshotId: {}, sortOrder: {} });
  return {
    users: tag("users"), patients: tag("patients"),
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
    vi.spyOn(db, "getDb").mockResolvedValue(makeDb() as any);
    await db.deleteAssessment(11, 1);
    // child tables must be deleted before the assessment row
    expect(deleted).toContain("annotations");
    expect(deleted).toContain("screenshots");
    expect(deleted).toContain("dynamoTests");
    expect(deleted).toContain("videos");
    expect(deleted).toContain("assessments");
    expect(deleted.indexOf("assessments")).toBe(deleted.length - 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test cascade`
Expected: FAIL — current `deleteAssessment` deletes only `assessments`, so `deleted` won't contain the child tables.

- [ ] **Step 3: Implement cascade in `server/db.ts`**

Replace `deleteAssessment` (~130-134) with a cascading version, and update `deletePatient` (~97-101) to cascade through assessments. Add a private helper so both share logic:

```ts
// Delete an assessment's children (annotations → via screenshots, then
// screenshots, dynamoTests, videos) and finally the assessment row itself.
// Caller must have already verified ownership.
async function cascadeDeleteAssessment(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, assessmentId: number) {
  const shots = await db.select({ id: screenshots.id }).from(screenshots).where(eq(screenshots.assessmentId, assessmentId));
  for (const s of shots) {
    await db.delete(annotations).where(eq(annotations.screenshotId, s.id));
  }
  await db.delete(screenshots).where(eq(screenshots.assessmentId, assessmentId));
  await db.delete(dynamoTests).where(eq(dynamoTests.assessmentId, assessmentId));
  await db.delete(videos).where(eq(videos.assessmentId, assessmentId));
  await db.delete(assessments).where(eq(assessments.id, assessmentId));
}

export async function deleteAssessment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Verify ownership before cascading.
  const owned = await db.select({ id: assessments.id }).from(assessments)
    .where(and(eq(assessments.id, id), eq(assessments.userId, userId))).limit(1);
  if (owned.length === 0) return;
  await cascadeDeleteAssessment(db, id);
}

export async function deletePatient(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Only cascade the caller's own patient.
  const owned = await db.select({ id: patients.id }).from(patients)
    .where(and(eq(patients.id, id), eq(patients.userId, userId))).limit(1);
  if (owned.length === 0) return;
  const rows = await db.select({ id: assessments.id }).from(assessments)
    .where(and(eq(assessments.patientId, id), eq(assessments.userId, userId)));
  for (const a of rows) {
    await cascadeDeleteAssessment(db, a.id);
  }
  await db.delete(patients).where(and(eq(patients.id, id), eq(patients.userId, userId)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test cascade`
Expected: PASS.

- [ ] **Step 5: Run the full server suite to check for regressions**

Run: `pnpm test`
Expected: all prior tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add server/db.ts server/cascade.test.ts
git commit -m "Cascade child rows when deleting patients and assessments"
```

---

## Task 7: Stop leaking `passwordHash` from `auth.me`

**Files:**
- Modify: `server/routers.ts` (`auth.me`, line 14)
- Modify: `server/features.test.ts` (extend the `auth.me` describe block)

- [ ] **Step 1: Add the failing test**

In `server/features.test.ts`, inside `describe("auth.me")`, add:

```ts
  it("never returns passwordHash", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({ id: 1, email: "physio@example.com", role: "user" });
  });
```

The existing `createAuthContext()` user has no `passwordHash` field; add one so the test is meaningful. In `features.test.ts`, in the `user` object inside `createAuthContext` (~10-20), add `passwordHash: "$2a$10$fakehashfakehashfakehash" as any,`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test features`
Expected: FAIL — `auth.me` returns the whole user including `passwordHash`.

- [ ] **Step 3: Whitelist the DTO**

Replace line 14 of `server/routers.ts`:

```ts
    me: publicProcedure.query(opts => opts.ctx.user),
```

with:

```ts
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { id, name, email, role } = ctx.user;
      return { id, name, email, role };
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test features`
Expected: PASS. The existing "returns null for unauthenticated" and "returns user object" tests still pass (they only assert `name`/`email`).

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/features.test.ts
git commit -m "Return a whitelisted DTO from auth.me (no passwordHash)"
```

---

## Task 8: Remove global-password login for password-less accounts

**Files:**
- Modify: `server/_core/auth.ts` (login handler, ~53-65)
- Create: `server/auth.login.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/auth.login.test.ts`:

```ts
import { describe, expect, it } from "vitest";

// passwordMatches only reads ENV (admin email/password) + bcrypt — no DB.
// Mock ENV as auth.ts imports it: from server/_core/auth.ts that specifier is
// "./env", which resolves to server/_core/env — the same module this test
// targets with the path relative to server/auth.login.test.ts.
vi.mock("./_core/env", () => ({ ENV: { adminEmail: "admin@clinic.com", adminPassword: "admin-secret" } }));

// Import the pure predicate we will extract from the login handler.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test auth.login`
Expected: FAIL — `passwordMatches` is not exported from `./auth`.

- [ ] **Step 3: Extract and fix the predicate**

In `server/_core/auth.ts`, add an exported helper (place above `registerAuthRoutes`):

```ts
// Returns true iff `password` authenticates `user`.
// - If the user has a bcrypt hash, compare against it.
// - Otherwise (legacy/no-hash account) accept the ENV admin password ONLY for
//   the configured admin email. Never for arbitrary password-less accounts.
export async function passwordMatches(
  user: { email?: string | null; passwordHash?: string | null },
  password: string
): Promise<boolean> {
  if (user.passwordHash) {
    return bcrypt.compare(password, user.passwordHash);
  }
  return (
    !!ENV.adminPassword &&
    user.email === ENV.adminEmail &&
    password === ENV.adminPassword
  );
}
```

Then in the login handler (~53-65) replace the inline password-check block:

```ts
      // Check password: if user has a passwordHash, use bcrypt; otherwise check ENV.adminPassword
      if (user.passwordHash) {
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          res.status(401).json({ error: "Invalid email or password" });
          return;
        }
      } else if (ENV.adminPassword && password === ENV.adminPassword) {
        // Legacy admin login without passwordHash
      } else {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
```

with:

```ts
      if (!(await passwordMatches(user, password))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test auth.login`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/_core/auth.ts server/auth.login.test.ts
git commit -m "Restrict password-less login to the admin email only"
```

---

## Task 9: Fail fast on empty `JWT_SECRET`

**Files:**
- Modify: `server/_core/env.ts`
- Create: `server/env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/env.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test env`
Expected: FAIL — `assertRequiredEnv` not exported.

- [ ] **Step 3: Implement**

In `server/_core/env.ts`, add below the `ENV` object:

```ts
export function assertRequiredEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): void {
  const isProd = source.NODE_ENV === "production";
  if (isProd && !source.JWT_SECRET) {
    throw new Error("JWT_SECRET is required in production but is empty. Set it in the Railway environment.");
  }
}
```

- [ ] **Step 4: Call it at boot**

In `server/_core/index.ts`, add the import and call it as the first line of `startServer()`:

Change the import block to add:

```ts
import { assertRequiredEnv } from "./env";
```

And at the top of `async function startServer() {`:

```ts
async function startServer() {
  assertRequiredEnv();
  const app = express();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test env`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/_core/env.ts server/_core/index.ts server/env.test.ts
git commit -m "Fail fast when JWT_SECRET is unset in production"
```

---

## Task 10: Tighten session cookie `sameSite`

**Files:**
- Modify: `server/_core/cookies.ts` (line 46)
- Create: `server/cookies.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/cookies.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test cookies`
Expected: FAIL — the https case currently returns `sameSite: "none"`.

- [ ] **Step 3: Implement**

In `server/_core/cookies.ts`, change line 46:

```ts
    sameSite: secure ? "none" : "lax",
```

to:

```ts
    sameSite: "lax",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test cookies`
Expected: PASS (2 tests).

> Note: the app is served from a single origin (Railway), so `lax` does not break the login flow. If a future phase needs cross-site embedding, revisit with a CSRF token.

- [ ] **Step 5: Commit**

```bash
git add server/_core/cookies.ts server/cookies.test.ts
git commit -m "Set session cookie sameSite=lax to reduce CSRF surface"
```

---

## Task 11: Rate-limit the login endpoint

**Files:**
- Modify: `package.json` (add `express-rate-limit`)
- Modify: `server/_core/auth.ts` (apply limiter to `/api/auth/login` and `/api/auth/register`)

- [ ] **Step 1: Install the dependency**

Run: `pnpm add express-rate-limit`
Expected: `express-rate-limit` appears in `dependencies`.

- [ ] **Step 2: Apply the limiter**

In `server/_core/auth.ts`, add the import at the top:

```ts
import rateLimit from "express-rate-limit";
```

Add a limiter constant above `registerAuthRoutes`:

```ts
// 10 attempts per 15 minutes per IP on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
```

Then apply it to both routes. Change:

```ts
  app.post("/api/auth/login", async (req: Request, res: Response) => {
```

to:

```ts
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
```

and:

```ts
  app.post("/api/auth/register", async (req: Request, res: Response) => {
```

to:

```ts
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
```

- [ ] **Step 3: Trust the proxy so rate-limiting keys on the real client IP**

In `server/_core/index.ts`, right after `const app = express();`, add:

```ts
  app.set("trust proxy", 1); // Railway terminates TLS at a proxy; use X-Forwarded-For
```

- [ ] **Step 4: Verify build and existing tests**

Run: `pnpm check && pnpm test`
Expected: typecheck clean, all tests pass (the limiter isn't exercised by unit tests; this is a wiring change).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml server/_core/auth.ts server/_core/index.ts
git commit -m "Rate-limit login and register endpoints"
```

---

## Task 12: Add security headers with helmet + CSP

**Files:**
- Modify: `package.json` (add `helmet`)
- Modify: `server/_core/index.ts`

- [ ] **Step 1: Install the dependency**

Run: `pnpm add helmet`
Expected: `helmet` in `dependencies`.

- [ ] **Step 2: Apply helmet with a CSP compatible with the app**

In `server/_core/index.ts`, add the import:

```ts
import helmet from "helmet";
```

After `app.set("trust proxy", 1);` (from Task 11) and before `app.use(express.json(...))`, add:

```ts
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Vite serves inline styles; Google Fonts is used by the report.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // Screenshots/PDF pages render as data: URLs; blob: for canvas exports.
        imgSrc: ["'self'", "data:", "blob:"],
        // pdf.js worker + report print window need blob:; scripts are bundled.
        scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    // The report opens a new tab via window.open + document.write; COEP/CORP
    // off avoids breaking that and the data: assets.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }));
```

- [ ] **Step 3: Verify the app still serves and the report still renders**

Run: `pnpm build` then start the server locally against a test DB (see Task 15 for the local-DB harness) and confirm:
- the app loads (no CSP violations blocking the bundle),
- Export PDF still opens a populated tab.

Expected: app loads; export works. If the browser console shows a CSP violation for a resource the app legitimately needs, add that host to the matching directive and re-test.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml server/_core/index.ts
git commit -m "Add helmet security headers with a CSP"
```

---

## Task 13: Lock down the file-upload path

**Files:**
- Modify: `server/routers.ts` (`upload.uploadFile`, ~340-348)
- Modify: `client/src/components/VideoAnalysis.tsx` (~211)
- Modify: `client/src/pages/AssessmentEditor.tsx` (~368, ~410)
- Create: `server/upload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/upload.test.ts`:

```ts
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
    await expect(caller.upload.uploadFile({ folder: "screenshots", fileName: "x.html", base64Data: "AAAA", contentType: "text/html" })).rejects.toThrow(/content type/i);
  });

  it("rejects a disallowed folder", async () => {
    const caller = appRouter.createCaller(authCtx(7));
    await expect(caller.upload.uploadFile({ folder: "../etc", fileName: "x.jpg", base64Data: "AAAA", contentType: "image/jpeg" })).rejects.toThrow(/folder/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test upload`
Expected: FAIL — `uploadFile` currently takes `key` (not `folder`/`fileName`) and does no validation.

- [ ] **Step 3: Rewrite `upload.uploadFile` to derive the key server-side**

Replace the `uploadFile` procedure (~340-348) with:

```ts
    uploadFile: protectedProcedure.input(z.object({
      folder: z.enum(["screenshots", "inbody", "vo2", "videos", "uploads"]),
      fileName: z.string().min(1),
      base64Data: z.string(),
      contentType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
      if (!ALLOWED.has(input.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported content type: ${input.contentType}` });
      }
      const buffer = Buffer.from(input.base64Data, "base64");
      const MAX_BYTES = 15 * 1024 * 1024;
      if (buffer.length > MAX_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File exceeds the 15 MB limit." });
      }
      const ext = (input.fileName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `${input.folder}/${ctx.user.id}/${nanoid()}.${ext}`;
      return storagePut(key, buffer, input.contentType);
    }),
```

> `input.folder` is a `z.enum`, so a folder like `../etc` fails Zod validation with a `BAD_REQUEST` whose message mentions the invalid value — matching the "rejects a disallowed folder" test's `/folder/i`. If the thrown message doesn't contain "folder", adjust the enum error by wrapping: add `.refine` is unnecessary; instead the test regex `/folder/i` matches the field name in the Zod error path. Verify in Step 5; if it doesn't match, change the test to assert `rejects.toThrow()` generically.

- [ ] **Step 4: Update the client call sites**

In `client/src/components/VideoAnalysis.tsx` (~211), replace:

```ts
      const result = await uploadFile.mutateAsync({
        key: `screenshots/${assessmentId}/${Date.now()}.jpg`,
        base64Data: base64,
        contentType: "image/jpeg",
      });
```

with:

```ts
      const result = await uploadFile.mutateAsync({
        folder: "screenshots",
        fileName: `${Date.now()}.jpg`,
        base64Data: base64,
        contentType: "image/jpeg",
      });
```

In `client/src/pages/AssessmentEditor.tsx`, the InBody upload (~368):

```ts
                    const result = await uploadFile.mutateAsync({
                      key: `inbody/${assessmentId}/${Date.now()}-${file.name}`,
                      base64Data: base64,
                      contentType: file.type,
                    });
```

becomes:

```ts
                    const result = await uploadFile.mutateAsync({
                      folder: "inbody",
                      fileName: `${Date.now()}-${file.name}`,
                      base64Data: base64,
                      contentType: file.type,
                    });
```

And the VO2 upload (~410) — same shape with `folder: "vo2"`:

```ts
                    const result = await uploadFile.mutateAsync({
                      folder: "vo2",
                      fileName: `${Date.now()}-${file.name}`,
                      base64Data: base64,
                      contentType: file.type,
                    });
```

> Note: `file.type` for a PDF is `application/pdf` and for images `image/*` — both in the allow-list. If a user uploads a non-allow-listed InBody file type, the server now rejects it; that is intended.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test upload && pnpm check`
Expected: upload tests PASS; typecheck clean. (If the "disallowed folder" assertion doesn't match, apply the fallback noted in Step 3.)

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts server/upload.test.ts client/src/components/VideoAnalysis.tsx client/src/pages/AssessmentEditor.tsx
git commit -m "Derive upload keys server-side; allow-list type and size"
```

---

## Task 14: Block SSRF in the PDF-fetch paths

**Files:**
- Create: `server/_core/ssrfGuard.ts`
- Create: `server/ssrfGuard.test.ts`
- Modify: `server/_core/index.ts` (`/api/pdf-proxy`, ~41-62)
- Modify: `server/routers.ts` (`pdf.toImages` remote-fetch branch, ~377-380)

- [ ] **Step 1: Write the failing test**

Create `server/ssrfGuard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPublicHttpUrl } from "./_core/ssrfGuard";

describe("isPublicHttpUrl", () => {
  it("allows a normal https URL", () => {
    expect(isPublicHttpUrl("https://mybucket.s3.ap-east-1.amazonaws.com/x.pdf")).toBe(true);
  });
  it("rejects non-http(s) schemes", () => {
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("gopher://x")).toBe(false);
  });
  it("rejects localhost and loopback", () => {
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
  });
  it("rejects private and link-local ranges", () => {
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.4.4/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ssrfGuard`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the guard**

Create `server/_core/ssrfGuard.ts`:

```ts
// Returns true only for http(s) URLs whose host is not localhost, a loopback,
// or a private / link-local IP literal. Blocks the common SSRF targets
// (cloud metadata at 169.254.169.254, internal services on 10/172.16/192.168).
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::1" || host === "0.0.0.0") return false;

  // IPv4 literal checks
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return false;                 // loopback
    if (a === 10) return false;                  // private
    if (a === 192 && b === 168) return false;    // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 169 && b === 254) return false;    // link-local / metadata
    if (a === 0) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test ssrfGuard`
Expected: PASS (5 tests).

- [ ] **Step 5: Guard `/api/pdf-proxy` (add auth + URL check)**

In `server/_core/index.ts`, add the imports:

```ts
import { isPublicHttpUrl } from "./ssrfGuard";
import { sdk } from "./sdk";
```

Replace the `/api/pdf-proxy` handler body's start (~42-47):

```ts
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }
    try {
      const response = await fetch(url);
```

with:

```ts
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }
    // Require a valid session — this endpoint fetches on the server's behalf.
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!isPublicHttpUrl(url)) {
      res.status(400).json({ error: "URL not allowed" });
      return;
    }
    try {
      const response = await fetch(url);
```

> Verify `sdk.authenticateRequest(req)` is the same call used in `server/_core/context.ts:17`. If the method name differs, use the one context.ts uses.

- [ ] **Step 6: Guard the `pdf.toImages` remote branch**

In `server/routers.ts`, in `pdf.toImages`, add the import at the top of the file if not present:

```ts
import { isPublicHttpUrl } from "./_core/ssrfGuard";
```

Change the remote-fetch branch (~376-380):

```ts
        } else {
          const resp = await fetch(input.url);
          if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
          buffer = Buffer.from(await resp.arrayBuffer());
        }
```

to:

```ts
        } else {
          if (!isPublicHttpUrl(input.url)) throw new Error("URL not allowed");
          const resp = await fetch(input.url);
          if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
          buffer = Buffer.from(await resp.arrayBuffer());
        }
```

- [ ] **Step 7: Verify build and tests**

Run: `pnpm check && pnpm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/_core/ssrfGuard.ts server/ssrfGuard.test.ts server/_core/index.ts server/routers.ts
git commit -m "Block SSRF: auth + public-URL allow-list on PDF fetch paths"
```

---

## Task 15: Full verification & cross-tenant smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite + typecheck + build**

Run: `pnpm check && pnpm test && pnpm build`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 2: Stand up a local test DB**

The production `.env` points `DATABASE_URL` at Railway; do NOT test against it. Use a local MySQL-compatible DB:

```bash
# One-time: install + start MariaDB (macOS)
brew install mariadb 2>/dev/null; /opt/homebrew/opt/mariadb/bin/mariadbd-safe --datadir=/opt/homebrew/var/mysql &
sleep 5
/opt/homebrew/opt/mariadb/bin/mariadb -u "$(whoami)" -e "CREATE DATABASE IF NOT EXISTS physio_local; CREATE USER IF NOT EXISTS 'physio'@'127.0.0.1' IDENTIFIED BY 'physio_local_pw'; GRANT ALL ON physio_local.* TO 'physio'@'127.0.0.1'; FLUSH PRIVILEGES;"
DATABASE_URL="mysql://physio:physio_local_pw@127.0.0.1:3306/physio_local" pnpm exec drizzle-kit migrate
```

- [ ] **Step 3: Start the built server against the local DB**

```bash
DATABASE_URL="mysql://physio:physio_local_pw@127.0.0.1:3306/physio_local" \
ADMIN_EMAIL="admin@local.test" ADMIN_PASSWORD="localtest123" \
JWT_SECRET="local-dev-secret-please-change-0000000000000000" \
PORT=3000 pnpm start &
sleep 5
```

- [ ] **Step 4: Verify cross-tenant access is blocked**

Create two accounts (register user A and user B), have A create a patient+assessment, note the assessment id, then confirm B gets `NOT_FOUND` calling `screenshot.list` / `dynamo.list` / `video.list` for A's assessment id, and that the unauthenticated case still rejects. Use `curl` against `/api/auth/register`, `/api/auth/login` (save cookies per user), and `/api/trpc/screenshot.list?...`. Expected: user B receives a tRPC `NOT_FOUND` error, not A's data.

> If you have the earlier session's scratchpad harness (`repro2.js` / `seed.js`), reuse it with two logins. Otherwise a short `curl` script suffices: the assertion is simply that B's request for A's ids returns an error, not rows.

- [ ] **Step 5: Verify the report still exports and is escaped**

With a seeded assessment whose patient name is `Test <img src=x onerror=alert(1)>`, open the report and Export PDF. Expected: the new tab opens, renders the report, and shows the literal patient-name text — no script executes, no console injection.

- [ ] **Step 6: Tear down the local DB**

```bash
kill %1 2>/dev/null
/opt/homebrew/opt/mariadb/bin/mariadb-admin -u "$(whoami)" shutdown 2>/dev/null
```

- [ ] **Step 7: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "Phase 1: security & data integrity" --body "$(cat <<'EOF'
Closes the cross-tenant IDOR, escapes report HTML/SVG, hardens login/session,
locks down upload + PDF-fetch, and cascades deletes.

See docs/superpowers/specs/2026-07-06-app-audit-remediation-design.md (Phase 1)
and docs/superpowers/plans/2026-07-06-phase1-security-data-integrity.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification checklist (whole phase)
- [ ] Cross-tenant reads/writes on screenshot/annotation/dynamo/video/analyzePose return NOT_FOUND (Tasks 2-5, 15.4).
- [ ] Report renders attacker-controlled names/AI text as inert text (Task 1, 15.5).
- [ ] `auth.me` never returns `passwordHash` (Task 7).
- [ ] Password-less accounts can't be opened with the admin password unless they are the admin email (Task 8).
- [ ] Server refuses to boot in production without `JWT_SECRET` (Task 9).
- [ ] Cookie is `sameSite=lax` (Task 10); login/register are rate-limited (Task 11); helmet+CSP applied (Task 12).
- [ ] Uploads are user-scoped, type/size-limited (Task 13); PDF fetches reject private/loopback/metadata URLs and require auth (Task 14).
- [ ] Deleting a patient/assessment removes all descendant rows (Task 6).
- [ ] `pnpm check && pnpm test && pnpm build` all green (Task 15.1).
