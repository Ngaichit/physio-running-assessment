# Video Present Mode — Design

**Date:** 2026-07-22
**Status:** Approved for planning
**Scope:** A fullscreen, live, ephemeral annotation mode over the running video —
OnForm-style — so a practitioner can freeze a frame and draw angles/lines on it
while the client watches. Nothing is saved.

## Context

Today the video editor (`client/src/components/VideoAnalysis.tsx`) supports:
video playback → capture a screenshot → annotate that saved screenshot in a
dialog (`AnnotationCanvas.tsx`). That flow builds the report and persists to the
DB.

What's missing is a **live, client-facing** experience: during a session the
practitioner wants to go fullscreen on the video, scrub to a gait phase, freeze
the frame, and draw angles/reference lines on it in real time — like OnForm. This
is a discussion aid, not report content, so it must be **ephemeral** (no saving)
and stay visually clean (no metrics panel, foot-label tagging, or save UI).

### Decisions taken
- **Ephemeral only** — no tRPC calls, no screenshot/annotation records.
- **Freeze-frame, then draw** — the user pauses/scrubs to a frame; drawing
  happens on the paused (frozen) frame, not over playing video.
- **Mac target** — the browser Fullscreen API works; no iPad workaround needed
  this round.
- **Raw video** — Present Mode shows the video without the alignment transform
  (`offsetX/Y/rotation/scale`); alignment exists only for screenshot consistency.
- **Separate from the persisted flow** — the existing annotation dialog's broken
  fullscreen is a distinct bug, explicitly out of scope here.

### Non-goals
- Saving live annotations (any form of persistence).
- Metrics selection, foot-label (L/R) tagging, grid overlay.
- Preserving drawings across frame changes (scrub/step/play clears them).
- Fixing the existing `AnnotationCanvas` dialog fullscreen bug.
- iPad/iOS fullscreen support.

---

## Architecture

### New files
- **`client/src/components/VideoPresentMode.tsx`** — the fullscreen view. Owns
  its own annotation state (in-memory array), playback control of a dedicated
  `<video>` element, and the drawing overlay. No props beyond what it needs to
  open: the video source and the time to open at, plus an `onClose` callback.
- **`client/src/lib/annotationGeometry.ts`** — pure functions extracted from
  `AnnotationCanvas.tsx`:
  - angle math: inner angle from 3 points, and the inner/outer/supplement display
    value.
  - per-type canvas draw helpers: `drawAngle`, `drawLine`, `drawRefLine`
    (horizontal/vertical), `drawCircle`, `drawText`, each `(ctx, annotation,
    opts)`.
  - point hit-testing helper (nearest point for drag).
  Both `AnnotationCanvas` and `VideoPresentMode` import these — single source of
  truth, no drift.
- **`client/src/lib/videoFrameRect.ts`** — pure helper: given container width/
  height and intrinsic video width/height, return the `object-contain`
  letterboxed content rectangle `{ left, top, width, height }`. Unit-testable.

### Edited files
- **`VideoAnalysis.tsx`** — add a **Present** button (monitor/presentation icon)
  in the player header next to Upload/Align, rendered only when `currentVideoSrc`
  exists. Clicking sets local `presenting` state and renders `<VideoPresentMode
  videoSrc={currentVideoSrc} startTime={currentTime} onClose={...} />`.
- **`AnnotationCanvas.tsx`** — refactor to consume the extracted
  `annotationGeometry` helpers in place of its inline copies (behavior
  unchanged; existing tests must stay green).

### Shared annotation model
Present Mode reuses the in-memory annotation shape already used by
`AnnotationCanvas` (`type`, `points`, `color`, `label`, `angleMode`). No new
persistence type; nothing is written to the server.

---

## Fullscreen layout

- On mount, call `requestFullscreen()` on the root container. Listen for
  `fullscreenchange`; if the user exits fullscreen (Esc or OS gesture), call
  `onClose` so the app state and the browser agree.
- Root: fixed, full-viewport, black background.
- **Video** centered, `object-contain`, maximum size.
- **Drawing canvas**: a transparent `<canvas>` absolutely positioned exactly over
  the video's rendered content rectangle (from `videoFrameRect.ts`). Pointer/touch
  events land here.
- **Floating top toolbar** (semi-transparent panel over the video):
  `angle · line · horizontal · vertical · circle · text | color swatches | undo ·
  clear | ✕ exit`. Reuses the `COLORS` and tool set from `AnnotationCanvas`.
- **Floating bottom bar**: `play/pause · scrub slider · time · frame-step ◀ ▶ ·
  step-size select`. Frame stepping reuses the existing `FRAME_STEPS` table and
  step logic from `VideoAnalysis`.

---

## Interaction model (freeze → draw → clear)

| Action | Behavior |
|---|---|
| Open Present Mode | Dedicated video loads `videoSrc`, seeks to `startTime`, paused (frozen frame shown) |
| Pick a drawing tool while playing | Auto-pause, so drawing is always on a frozen frame |
| Draw | Tap-to-place points (angle = 3, line = 2, circle = 2, horizontal/vertical/text = 1); drag existing points to adjust |
| Text tool | Tapping places the label point and opens a small inline text input at that point; typing commits the label, Esc/blur cancels an empty one |
| Scrub / play / frame-step | **Clears** the overlay annotations — they belong to a single frame |
| Undo | Removes the last annotation |
| Clear | Removes all annotations on the current frame |
| Keyboard | Space = play/pause, ← / → = frame-step, Esc = exit |
| Exit (✕ / Esc) | Exit fullscreen and call `onClose` |

- Annotations live only in component state; unmounting discards them.
- Because drawings clear on any frame change, the workflow is: scrub/step to the
  frame first, then draw.

### Coordinate mapping
- The overlay canvas backing store matches the video content rect (scaled by
  `devicePixelRatio` for crisp lines); its CSS box is positioned on that rect.
- Recompute the rect on `loadedmetadata`, `resize`, and `fullscreenchange`.
- **Point storage:** Present Mode stores annotation points as **normalized
  `[0,1]` coordinates within the video content rect**, converting to/from canvas
  pixels via the current rect. Because `object-contain` preserves the video's
  aspect ratio, the content rect always scales **uniformly** on resize, so
  normalized→pixel conversion is a uniform scale and drawn angles are preserved.
- **Shared draw helpers operate in the target canvas's pixel space.** Each
  consumer converts its stored points to pixels before calling: Present Mode from
  normalized coords (above); `AnnotationCanvas` is unchanged (it already works in
  its canvas pixel space). This keeps `annotationGeometry` coordinate-space
  agnostic.

---

## Error handling & edge cases
- `requestFullscreen()` rejects (rare on Mac): fall back to a fixed full-viewport
  overlay (not true OS fullscreen) so the feature still works; log and continue.
- Video with no intrinsic dimensions yet (metadata not loaded): show a spinner;
  don't render the overlay canvas until `loadedmetadata` gives real
  width/height.
- Window/element resize mid-session: recompute the content rect and re-render
  annotations at the new scale (points are stored in normalized `[0,1]`
  coordinates — see Coordinate mapping — so they survive resize).

## Testing
- **Unit** — `annotationGeometry`: inner/outer/supplement angle values for known
  point sets; `videoFrameRect`: letterbox math for wider-than, taller-than, and
  exact-fit aspect ratios.
- **Regression** — existing `AnnotationCanvas` tests stay green after it switches
  to the shared geometry module.
- **Manual** — in the running app: open Present Mode, fullscreen, freeze a frame,
  draw an angle/line, scrub (annotations clear), undo/clear, exit. Verify tap
  alignment on the frame.

## Sequencing
1. Extract `annotationGeometry.ts` and repoint `AnnotationCanvas` at it (keep
   tests green).
2. Add `videoFrameRect.ts` + unit tests.
3. Build `VideoPresentMode.tsx` (layout → playback → overlay drawing → freeze/
   clear).
4. Wire the Present button into `VideoAnalysis.tsx`.
5. Manual verification pass.
