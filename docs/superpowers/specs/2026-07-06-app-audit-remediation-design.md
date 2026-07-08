# Physio Running Assessment — Audit Remediation Design

**Date:** 2026-07-06
**Status:** Approved for planning
**Scope:** Phased remediation of findings from a four-part audit (security, performance/data, code quality, product/ops).

## Context

The app (Express + tRPC + Drizzle/MySQL server, Vite+React+wouter client) is a
physiotherapy running-assessment tool: patients → assessments → video
screenshots + annotations → InBody/VO2 PDF uploads → AI-generated report →
print/PDF export. Deployed on Railway; users are physio practitioners in Hong
Kong. **Multiple practitioner accounts exist in production**, each owning
separate patient records.

The app is functionally solid, but the audit found one live security breach,
several data-integrity and reliability gaps, and accumulated cleanup debt. This
document sequences the fixes into phases.

### Decisions taken
- **Multi-tenant reality:** other practitioners have real accounts → the
  cross-tenant IDOR is actively exploitable → Phase 1 / P0.
- **No S3 for now:** stay with base64-in-MySQL; recover speed with in-DB
  mitigations (Phase 3). S3 migration is documented as a future option only
  (Appendix A), not in current scope.
- **One phased spec:** security is Phase 1, but delivered after the full plan is
  reviewed (not fast-tracked as a standalone hotfix).

### Non-goals
- S3 / object-storage migration (deferred; see Appendix A).
- Any redesign of the assessment workflow or report content itself.
- New product features beyond data export (Phase 5).

---

## Phase 1 — Security & Data Integrity (P0)

**Goal:** stop the live cross-tenant exposure and the silent data loss on delete.

### 1.1 Cross-tenant IDOR (critical)
DB helpers that take only a child id (`assessmentId` / `screenshotId` / row
`id`) perform no ownership check. Any authenticated user can read/modify/delete
another clinic's data by iterating integer ids.

Affected procedures (`server/routers.ts` → `server/db.ts`):
`screenshot.list/create/update/delete`, `annotation.list/create/update/delete`,
`dynamo.list/create/update/delete`, `video.list/delete`, and `ai.analyzePose`
(writes annotations to any screenshot).

**Approach:** thread `ctx.user.id` into every affected DB helper and enforce
ownership by joining up to `assessments.userId`:
- `assessmentId`-scoped calls: join `... → assessments` and require
  `assessments.userId = userId`.
- `screenshotId`-scoped calls: join `screenshots → assessments` → `userId`.
- annotation `id` / screenshot `id` calls: join up the chain to `userId`.
- Return `TRPCError({ code: 'NOT_FOUND' })` when the join yields nothing (do not
  distinguish "not found" from "not yours").

**Acceptance:** an integration test proves user B cannot read or mutate user A's
screenshots/annotations/dynamo/videos through any endpoint (expect NOT_FOUND).

### 1.2 HTML/SVG injection in the report (high)
Patient names, practitioner fields, screenshot descriptions, and AI-generated
text are interpolated unescaped into the print HTML
(`ReportPreview.tsx` ~980–1390, written via `document.write`) and the asymmetry
SVG (`generateAsymmetryChartSVG` ~357–420, injected via
`dangerouslySetInnerHTML` ~1669). A patient named `<script>…`, or a
prompt-injected AI response, executes in the app origin.

**Approach:** add an `escapeHtml` helper; escape every interpolated
user/AI-derived value in the print template, `asText`, `bulletListHtml`, and the
SVG text builders. Treat LLM output as untrusted data, not markup.

**Acceptance:** a report built from a patient named
`</text><img src=x onerror=alert(1)>` renders the literal text, executes nothing.

### 1.3 Login & session hardening (high/medium)
- `auth.ts:53-65` — remove the branch that lets any password-less account log in
  with `ENV.adminPassword`; allow the ENV-password path only when
  `email === ENV.adminEmail`.
- Add IP+account rate limiting / backoff on `/api/auth/login`.
- `auth.me` (`routers.ts:14`) — return a whitelisted DTO (`id,name,email,role`),
  never `passwordHash`.
- `env.ts:2` — fail fast at boot if `JWT_SECRET` is empty.
- `cookies.ts:44-47` — `sameSite: "lax"` unless cross-site embedding is needed.
- Add `helmet` with a CSP (also mitigates 1.2).

### 1.4 Upload path & SSRF (high/medium)
- `upload.uploadFile` (`routers.ts:340-348`) — derive/validate the storage key
  server-side scoped to `ctx.user.id`; reject `..`/absolute keys; allow-list
  content types (image/* and application/pdf only); enforce a max byte size.
- `/api/pdf-proxy` (`_core/index.ts:41-62`) — require auth and restrict fetches
  to an allow-list of own-storage hosts; block private/link-local ranges. Same
  guard for `pdf.toImages` (`routers.ts:377`). Prefer `execFileSync` over
  `execSync` for `pdftoppm` (`routers.ts:391`).

### 1.5 Delete cascade & orphan cleanup (data integrity)
No foreign keys exist; `deletePatient`/`deleteAssessment` delete only their own
row, orphaning all child screenshots/annotations/dynamo/videos (multi-MB base64)
forever. The confirm dialog's "removes all their assessments" is false.

**Approach:** add cascading deletes — either FK `onDelete: 'cascade'` in the
schema (new migration) or explicit cascade in the delete helpers covering
patient → assessments → (screenshots → annotations, dynamoTests, videos).
Make `deletePatient`/`deleteAssessment` transactional.

**Acceptance:** deleting a patient removes every descendant row; a test asserts
no orphaned screenshots/annotations remain.

---

## Phase 2 — Core Reliability & Trust

**Goal:** make the AI-report and editor flows dependable; learn of breakage
before a client is in the room.

### 2.1 One shared report data model
Today the report shape is defined three times: client `interface ReportData`
(`ReportPreview.tsx:454-489`), the LLM `json_schema`
(`routers.ts:638-690`), and implicitly as `reportJson: z.any()` (persisted
unvalidated). They drift.

**Approach:** define one `zReportData` (Zod) in `shared/`; derive the TS type via
`z.infer`; generate the LLM JSON schema from it (`zod-to-json-schema`); use it as
the `reportJson` validator in `assessment.update`; re-parse the LLM response with
it.

### 2.2 Fix the AI report call
`invokeLLM` (`llm.ts:207`) never forwards `response_format`, so the elaborate
`json_schema` (`routers.ts:633-699`) is dead — correctness rests on prompt text
plus fragile regex code-fence stripping and `JSON.parse` (`routers.ts:704-713`).
No timeout, retry, or cancel; `max_tokens: 8096`.

**Approach:** enforce JSON via Anthropic tool-use (forced `tool_choice`) driven
by the 2.1 schema, or delete the dead `response_format` and lean on the prompt
deliberately — then re-validate with `zReportData`. Add an explicit request
timeout + one retry and a clean error surfaced to the client. Move the hardcoded
model id (`llm.ts:213`) to an env var.

### 2.3 Stop work loss in the editor
- No autosave and no unsaved-changes guard (`AssessmentEditor.tsx`) — Back /
  refresh / tab-close discards typed notes.
- `handleGenerateReport` proceeds even when the pre-save fails
  (`handleSave` swallows errors ~100-104) → report built from stale DB data with
  a success toast.

**Approach:** debounced autosave (≈3s idle) through the existing
`assessment.update`, driving the `status` field (draft/in_progress/completed);
`beforeunload` + wouter route-change confirm gated on `hasChanges`; make
`handleSave` return/throw success and abort generation on failure.

### 2.4 Error states & small correctness fixes
- Add `isError` branches distinct from empty states on `Home`, `PatientDetail`,
  `AssessmentEditor` (a DB outage currently looks like "no patients").
- `getDefaultPractitioner`/`getPractitioner`/`getAssessment` (`db.ts`) —
  `return result[0] ?? null` (undefined breaks react-query, causes the
  `getDefault` console error).
- `ErrorBoundary` — add logging (feeds 2.5).
- `generateAsymmetryChartSVG` (`ReportPreview.tsx:420`) — drop `height="auto"`
  attribute, use CSS or a computed pixel height (fixes the console error).
- Analytics (`client/index.html:20-21`) — define `VITE_ANALYTICS_ENDPOINT` /
  `VITE_ANALYTICS_WEBSITE_ID` as Railway **build-time** vars, or remove the tag
  (currently 404s on every page load and has collected zero events).

### 2.5 Observability & deploy safety
- Add Sentry to the client `ErrorBoundary` and the server tRPC error formatter.
- Add `GET /healthz` (200 after a DB ping); configure as Railway's healthcheck.
- Bind `process.env.PORT` directly in production; drop the port-scan fallback
  (`_core/index.ts:21-28,79-84`) that can silently bind an unreachable port.
- Replace plain `throw new Error` in routers with typed `TRPCError`; add
  structured logging with request/assessment context; log before the three
  silent `catch {}` sites (`routers.ts:385,409,414`).

---

## Phase 3 — Performance (in-DB, no new infra)

**Goal:** recover responsiveness for HK users without provisioning S3.

- **gzip compression** — `app.use(compression())` before tRPC
  (`_core/index.ts`). Biggest single latency lever; base64 payloads are highly
  compressible. (Confirm Railway edge isn't already gzipping.)
- **Column projection** — `getAssessments`/`getAssessment` (`db.ts:104-115`) stop
  `SELECT *`; omit `inbodyFileUrl`/`vo2FileUrl`/`aiGeneratedReport`/`reportJson`
  from list/detail; fetch blob columns only via a dedicated file endpoint.
- **`screenshot.listMeta`** — return id/viewType/gaitPhase/sortOrder/thumbnailUrl
  only for grids; fetch full `imageUrl` on demand. Actually render
  `thumbnailUrl` in card grids (`VideoAnalysis.tsx:347` currently uses full
  `imageUrl`; `thumbnailUrl` is unused client-side).
- **DB indexes** — none exist. Add on all FK-style columns:
  `screenshots.assessmentId`, `annotations.screenshotId`,
  `dynamoTests.assessmentId`, `videos.assessmentId`, `patients.userId`,
  composite `(userId,patientId)` on assessments, `userId` on the per-user config
  tables (new migration).
- **Parallelize annotation fetches** — client export loop
  (`ReportPreview.tsx:741-750`) → `Promise.all` so `httpBatchLink` coalesces;
  server `generateReport` loop (`routers.ts:566-571`) → single
  `WHERE screenshotId IN (...)`, projecting metadata only (the image bytes are
  fetched and thrown away today).
- **React Query defaults** (`main.tsx:11`) — set `staleTime` (≥60s) and
  `refetchOnWindowFocus: false` so image-heavy queries stop re-downloading on tab
  focus.
- **Bundle** — `React.lazy` the route pages; dynamic-`import()` pdfjs inside the
  export handler (it's eagerly in the 1.2MB main chunk today).

---

## Phase 4 — S3 Storage Migration (deferred — out of current scope)

Not built now (no S3 this round). If/when a bucket is provisioned, see
Appendix A. Phase 3 mitigations stand in until then.

---

## Phase 5 — Maintainability & Continuity

**Goal:** shrink the surface, stop renderer drift, add a quality gate and a
backup story.

- **Delete dead code (~2,900 lines) + unused deps** — `pages/ComponentShowcase`
  (1,437), `components/Map`, `components/SideComparison`, `components/AIChatBox`,
  `components/ui/chart`; deps `framer-motion`, `axios`, `recharts`,
  `@types/google.maps`. Zero-risk; may be pulled to the front of any phase to
  shrink the working surface. Also remove root scratch files
  (`*-notes.txt`, `todo.md`, `.DS_Store`, `.manus/`).
- **Split `ReportPreview.tsx` (1,979 lines)** into `report/canvas.ts`,
  `report/charts.ts`, `report/printTemplate.ts`, `report/format.ts`, leaving a
  ~500-line component. **Unify the two renderers** — extract pure
  `section → {rows, ratingClass}` builders consumed by both the React preview and
  the HTML serializer, so they can't drift (they already disagree: JSX asymmetry
  is a 4-tier scale, print HTML is 3-tier). Depends on the 2.1 shared model.
- **Split `routers.ts` (1,399 lines)** into per-domain routers; move the AI
  prompt/schema into `server/ai/`.
- **Tooling** — flat ESLint config with `@typescript-eslint` +
  `eslint-plugin-unused-imports`; GitHub Actions CI running `check` + `test`;
  a README documenting env vars and the `pdftoppm` runtime dependency.
- **Data export / backup** — per-patient and full-account export (JSON/CSV +
  attached PDFs). Doubles as the missing backup story (no DB dump exists today).
- **Tests** — unit-test the extracted pure builders; snapshot-test the print HTML
  against a fixture report so preview/print agreement is enforced.

---

## Sequencing & dependencies
- Phase 1 first (live exposure).
- 2.1 shared report model is a prerequisite for the Phase 5 renderer unification
  and for `reportJson` validation.
- Phase 5 dead-code deletion is zero-risk and may be done at any point.
- Phases 2 and 3 are largely independent and can interleave.

## Appendix A — S3 migration (future)
Config is stubbed for `ap-east-1`; presigned-upload code exists but is dormant
(`storage.ts` falls back to inline base64 when AWS env is unset). To adopt:
provision an `ap-east-1` bucket + IAM creds + CORS; change
`screenshots.imageUrl`/`thumbnailUrl` and `assessments.inbody/vo2FileUrl` to hold
S3 keys; write a migration to move existing base64 rows to objects; delete
objects on cascade (Phase 1.5). Benefits: small backable-up DB, fast list
queries, browser-cacheable assets, no 16MB column cap.
