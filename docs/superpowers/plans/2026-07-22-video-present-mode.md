# Video Present Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen, live, ephemeral "Present Mode" that lets a practitioner freeze a video frame and draw angles/lines on it while a client watches — nothing saved.

**Architecture:** A new `VideoPresentMode` component renders a fixed full-viewport overlay (requesting browser fullscreen) with the video and a transparent drawing canvas layered exactly over the letterboxed video rect. Two pure helper modules are shared/added: `annotationGeometry` (angle math extracted from `AnnotationCanvas` — single source of truth for the drift-prone calculations) and `videoFrameRect` (letterbox math). Drawing is in-memory only; changing frames clears it.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, shadcn/ui (`Button`, `Slider`, `Select`), lucide-react icons, Canvas 2D, vitest (node env — pure modules only).

**Refinement vs spec:** The spec proposed extracting per-type *draw* helpers and repointing `AnnotationCanvas` at them. `AnnotationCanvas` (1253 lines) has **no tests**, so this plan shares only the pure **geometry** (angle math — the real drift risk, now unit-tested) and gives `VideoPresentMode` its own compact draw routine that calls that geometry. `AnnotationCanvas`'s renderer is left intact except for importing the shared angle functions. Single-source-of-truth for the calculations is preserved; regression risk to the untested renderer is minimized.

---

## File Structure

- **Create** `client/src/lib/annotationGeometry.ts` — pure types + `calculateInnerAngle`, `getEffectiveAngle`. Imported by both `AnnotationCanvas` and `VideoPresentMode`.
- **Create** `client/src/lib/annotationGeometry.test.ts` — unit tests for the angle math.
- **Create** `client/src/lib/videoFrameRect.ts` — pure `containVideoRect` letterbox helper.
- **Create** `client/src/lib/videoFrameRect.test.ts` — unit tests.
- **Create** `client/src/components/VideoPresentMode.tsx` — the fullscreen live-annotation view.
- **Modify** `client/src/components/AnnotationCanvas.tsx` — import the two angle functions from `annotationGeometry` instead of its local copies (behavior unchanged).
- **Modify** `client/src/components/VideoAnalysis.tsx` — add a "Present" button and render `VideoPresentMode`.

---

## Task 1: Shared angle geometry module

**Files:**
- Create: `client/src/lib/annotationGeometry.ts`
- Test: `client/src/lib/annotationGeometry.test.ts`
- Modify: `client/src/components/AnnotationCanvas.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/annotationGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateInnerAngle, getEffectiveAngle, type Point } from "./annotationGeometry";

const pts = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

describe("calculateInnerAngle", () => {
  it("returns 90° for a right angle", () => {
    // arm → vertex → arm; vertex at origin
    expect(calculateInnerAngle(pts([0, 1], [0, 0], [1, 0]))).toBeCloseTo(90, 6);
  });
  it("returns 180° for a straight line through the vertex", () => {
    expect(calculateInnerAngle(pts([-1, 0], [0, 0], [1, 0]))).toBeCloseTo(180, 6);
  });
  it("returns 45° for a diagonal arm", () => {
    expect(calculateInnerAngle(pts([1, 1], [0, 0], [1, 0]))).toBeCloseTo(45, 6);
  });
  it("returns 0 when fewer than 3 points", () => {
    expect(calculateInnerAngle(pts([0, 0], [1, 1]))).toBe(0);
  });
  it("returns 0 when an arm has zero length (degenerate)", () => {
    expect(calculateInnerAngle(pts([0, 0], [0, 0], [1, 0]))).toBe(0);
  });
});

describe("getEffectiveAngle", () => {
  const right = pts([0, 1], [0, 0], [1, 0]); // inner = 90
  it("returns the inner angle by default", () => {
    expect(getEffectiveAngle(right)).toBeCloseTo(90, 6);
  });
  it("returns 360 - inner for outer mode", () => {
    expect(getEffectiveAngle(right, "outer")).toBeCloseTo(270, 6);
  });
  it("returns |180 - inner| for supplement mode", () => {
    expect(getEffectiveAngle(right, "supplement")).toBeCloseTo(90, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/annotationGeometry.test.ts`
Expected: FAIL — `Cannot find module './annotationGeometry'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/lib/annotationGeometry.ts`. The `calculateInnerAngle` body is copied **verbatim** from `AnnotationCanvas.tsx:205-215` so behavior is identical:

```ts
export type Point = { x: number; y: number };
export type AnnotationType = "line" | "angle" | "circle" | "text" | "horizontal" | "vertical";
export type AngleMode = "inner" | "outer" | "supplement";

// Calculate inner angle between 3 points (always returns the smaller angle 0-180).
// Copied verbatim from AnnotationCanvas so both renderers agree.
export function calculateInnerAngle(points: Point[]): number {
  if (points.length < 3) return 0;
  const [p1, vertex, p2] = points;
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI;
}

// Effective angle for the chosen display mode.
export function getEffectiveAngle(points: Point[], mode: AngleMode = "inner"): number {
  const inner = calculateInnerAngle(points);
  if (mode === "outer") return 360 - inner;
  if (mode === "supplement") return Math.abs(180 - inner);
  return inner;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/annotationGeometry.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Repoint AnnotationCanvas at the shared module**

In `client/src/components/AnnotationCanvas.tsx`:

1. Add to the imports (after line 13, `import { toast } from "sonner";`):

```ts
import { calculateInnerAngle as calcInnerAngle, getEffectiveAngle as getEffAngle } from "@/lib/annotationGeometry";
```

2. Replace the local `calculateInnerAngle` definition (`AnnotationCanvas.tsx:204-215`) with a thin wrapper that preserves the existing `useCallback` identity used in dependency arrays:

```ts
  // Calculate inner angle between 3 points (delegates to shared geometry).
  const calculateInnerAngle = useCallback((points: Point[]): number => calcInnerAngle(points), []);
```

3. Replace the local `getEffectiveAngle` body (`AnnotationCanvas.tsx:218-224`) with a wrapper that maps the annotation's mode:

```ts
  // Get effective angle for an annotation based on angleMode.
  const getEffectiveAngle = useCallback((ann: DrawingAnnotation): number => {
    const mode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
    return getEffAngle(ann.points, mode);
  }, []);
```

The local `Point`/`AngleMode` type aliases (`AnnotationCanvas.tsx:16-17`) stay as-is; they are structurally identical to the shared ones.

- [ ] **Step 6: Verify nothing broke**

Run: `npm run check`
Expected: no type errors.
Run: `npx vitest run`
Expected: all existing tests + the 8 new ones PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/annotationGeometry.ts client/src/lib/annotationGeometry.test.ts client/src/components/AnnotationCanvas.tsx
git commit -m "Extract shared annotation angle geometry with tests"
```

---

## Task 2: Letterbox rect helper

**Files:**
- Create: `client/src/lib/videoFrameRect.ts`
- Test: `client/src/lib/videoFrameRect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/videoFrameRect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { containVideoRect } from "./videoFrameRect";

describe("containVideoRect", () => {
  it("letterboxes left/right when container is wider than the video", () => {
    // 200x100 container, 1:1 video → 100x100 centered
    expect(containVideoRect(200, 100, 100, 100)).toEqual({ left: 50, top: 0, width: 100, height: 100 });
  });
  it("letterboxes top/bottom when container is taller than the video", () => {
    // 100x200 container, 2:1 video → 100x50 centered vertically
    expect(containVideoRect(100, 200, 200, 100)).toEqual({ left: 0, top: 75, width: 100, height: 50 });
  });
  it("fills exactly when aspect ratios match", () => {
    expect(containVideoRect(300, 150, 200, 100)).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });
  it("returns a zero rect for degenerate inputs", () => {
    expect(containVideoRect(0, 100, 100, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(containVideoRect(100, 100, 0, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/videoFrameRect.test.ts`
Expected: FAIL — `Cannot find module './videoFrameRect'`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/lib/videoFrameRect.ts`:

```ts
export type Rect = { left: number; top: number; width: number; height: number };

// The object-contain rectangle of a video with intrinsic size (videoW x videoH)
// centered inside a container (containerW x containerH). Preserves aspect ratio,
// so the returned rect always has the video's aspect and scales uniformly.
export function containVideoRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): Rect {
  if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const videoAspect = videoW / videoH;
  const containerAspect = containerW / containerH;
  let width: number;
  let height: number;
  if (containerAspect > videoAspect) {
    height = containerH;
    width = containerH * videoAspect;
  } else {
    width = containerW;
    height = containerW / videoAspect;
  }
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/videoFrameRect.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/videoFrameRect.ts client/src/lib/videoFrameRect.test.ts
git commit -m "Add object-contain video rect helper with tests"
```

---

## Task 3: VideoPresentMode component

**Files:**
- Create: `client/src/components/VideoPresentMode.tsx`

This component is UI-heavy and cannot be unit-tested (vitest runs in `node`, no jsdom). It is verified by `npm run check` (types) here and by the manual pass in Task 5.

- [ ] **Step 1: Create the component**

Create `client/src/components/VideoPresentMode.tsx` with the complete file:

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CornerDownRight, Minus, MoveHorizontal, MoveVertical, Circle, Type,
  Undo2, Eraser, X, Play, Pause, ChevronLeft, ChevronRight,
} from "lucide-react";
import { calculateInnerAngle, type Point, type AnnotationType } from "@/lib/annotationGeometry";
import { containVideoRect, type Rect } from "@/lib/videoFrameRect";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];

const FRAME_STEPS = [
  { label: "1/120s", value: 1 / 120 },
  { label: "1/60s", value: 1 / 60 },
  { label: "1/30s", value: 1 / 30 },
  { label: "1/15s", value: 1 / 15 },
  { label: "1/10s", value: 1 / 10 },
];

type LiveAnnotation = { type: AnnotationType; points: Point[]; color: string; label: string };

interface Props {
  videoSrc: string;
  startTime: number;
  onClose: () => void;
}

const TOOLS: { type: AnnotationType; icon: any; title: string }[] = [
  { type: "angle", icon: CornerDownRight, title: "Angle (3 pts)" },
  { type: "line", icon: Minus, title: "Line (2 pts)" },
  { type: "horizontal", icon: MoveHorizontal, title: "Horizontal line" },
  { type: "vertical", icon: MoveVertical, title: "Vertical line" },
  { type: "circle", icon: Circle, title: "Circle (2 pts)" },
  { type: "text", icon: Type, title: "Text label" },
];

function neededPoints(tool: AnnotationType): number {
  return tool === "angle" ? 3 : tool === "line" ? 2 : tool === "circle" ? 2 : 1;
}

export default function VideoPresentMode({ videoSrc, startTime, onClose }: Props) {
  const [tool, setTool] = useState<AnnotationType>("angle");
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState<LiveAnnotation[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [frameStepIndex, setFrameStepIndex] = useState(2);
  const [rect, setRect] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState<{ annIndex: number; pointIndex: number } | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeThrottle = useRef(0);

  // Drawing requires a frozen frame — clear the overlay whenever the frame changes.
  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setCurrentPoints([]);
    setTextDraft(null);
  }, []);

  // Compute the letterboxed video rect from the container + intrinsic video size.
  const recomputeRect = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video || !video.videoWidth) return;
    setRect(containVideoRect(container.clientWidth, container.clientHeight, video.videoWidth, video.videoHeight));
  }, []);

  // Enter fullscreen on mount; close when the user leaves fullscreen.
  useEffect(() => {
    const el = containerRef.current;
    if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    const onFsChange = () => {
      recomputeRect();
      // If we were fullscreen and the user exited (Esc/gesture), close the overlay.
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute rect on window resize.
  useEffect(() => {
    window.addEventListener("resize", recomputeRect);
    return () => window.removeEventListener("resize", recomputeRect);
  }, [recomputeRect]);

  // Video event wiring.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      video.currentTime = startTime;
      setDuration(video.duration);
      recomputeRect();
    };
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - timeThrottle.current > 50) {
        setCurrentTime(video.currentTime);
        timeThrottle.current = now;
      }
    };
    const onSeeked = () => setCurrentTime(video.currentTime);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [startTime, recomputeRect]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      clearAnnotations(); // playing invalidates the frozen-frame drawings
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [clearAnnotations]);

  const seekTo = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    clearAnnotations();
    video.currentTime = Math.max(0, Math.min(video.duration || t, t));
    setCurrentTime(video.currentTime);
  }, [clearAnnotations]);

  const stepFrame = useCallback((direction: number) => {
    const video = videoRef.current;
    if (!video) return;
    seekTo(video.currentTime + direction * FRAME_STEPS[frameStepIndex].value);
  }, [frameStepIndex, seekTo]);

  // Picking a tool while playing pauses so drawing lands on a frozen frame.
  const selectTool = useCallback((t: AnnotationType) => {
    const video = videoRef.current;
    if (video && !video.paused) { video.pause(); setIsPlaying(false); }
    setTool(t);
    setCurrentPoints([]);
    setTextDraft(null);
  }, []);

  // Keyboard: space play/pause, arrows step. (Esc exits fullscreen → onClose.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepFrame(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stepFrame(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, stepFrame]);

  const pointerToNormalized = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const findNearestPoint = (p: Point) => {
    const threshold = 25 / Math.max(rect.width, 1);
    let best: { annIndex: number; pointIndex: number; dist: number } | null = null;
    for (let ai = 0; ai < annotations.length; ai++) {
      for (let pi = 0; pi < annotations[ai].points.length; pi++) {
        const pt = annotations[ai].points[pi];
        const dist = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (dist < threshold && (!best || dist < best.dist)) best = { annIndex: ai, pointIndex: pi, dist };
      }
    }
    return best;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerToNormalized(e);
    // Drag an existing point if we're not mid-placement.
    const near = currentPoints.length === 0 ? findNearestPoint(p) : null;
    if (near) { setDragging(near); return; }

    if (tool === "text") {
      setTextDraft({ x: p.x, y: p.y, value: "" });
      return;
    }

    const next = [...currentPoints, p];
    setCurrentPoints(next);
    if (next.length >= neededPoints(tool)) {
      setAnnotations(prev => [...prev, { type: tool, points: next, color, label: "" }]);
      setCurrentPoints([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const p = pointerToNormalized(e);
    setAnnotations(prev => {
      const updated = [...prev];
      const ann = { ...updated[dragging.annIndex] };
      const pts = [...ann.points];
      pts[dragging.pointIndex] = p;
      ann.points = pts;
      updated[dragging.annIndex] = ann;
      return updated;
    });
  };

  const handlePointerUp = () => setDragging(null);

  const commitText = () => {
    if (textDraft && textDraft.value.trim()) {
      setAnnotations(prev => [...prev, { type: "text", points: [{ x: textDraft.x, y: textDraft.y }], color, label: textDraft.value.trim() }]);
    }
    setTextDraft(null);
  };

  const undoLast = () => {
    if (currentPoints.length > 0) { setCurrentPoints([]); return; }
    setAnnotations(prev => prev.slice(0, -1));
  };

  // ---- Draw the overlay whenever state or rect changes ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const all: LiveAnnotation[] = currentPoints.length > 0
      ? [...annotations, { type: tool, points: currentPoints, color, label: "" }]
      : annotations;

    for (const ann of all) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([]);

      if (ann.type === "horizontal" && ann.points.length >= 1) {
        const py = ann.points[0].y * h;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
        ctx.setLineDash([]);
      } else if (ann.type === "vertical" && ann.points.length >= 1) {
        const px = ann.points[0].x * w;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
        ctx.setLineDash([]);
      } else if (ann.type === "line" && ann.points.length >= 2) {
        const [a, b] = ann.points;
        ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
      } else if (ann.type === "angle" && ann.points.length >= 2) {
        for (let i = 0; i < ann.points.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(ann.points[i].x * w, ann.points[i].y * h);
          ctx.lineTo(ann.points[i + 1].x * w, ann.points[i + 1].y * h);
          ctx.stroke();
        }
        if (ann.points.length === 3) {
          const value = Math.round(calculateInnerAngle(ann.points) * 10) / 10;
          const vertex = ann.points[1];
          const vx = vertex.x * w;
          const vy = vertex.y * h;
          const startAngle = Math.atan2((ann.points[0].y - vertex.y) * h, (ann.points[0].x - vertex.x) * w);
          const endAngle = Math.atan2((ann.points[2].y - vertex.y) * h, (ann.points[2].x - vertex.x) * w);
          ctx.beginPath(); ctx.arc(vx, vy, 22, startAngle, endAngle, calculateInnerAngle(ann.points) > 180); ctx.stroke();
          const mid = (startAngle + endAngle) / 2;
          const tx = vx + Math.cos(mid) * 40;
          const ty = vy + Math.sin(mid) * 40;
          const label = `${value}°`;
          ctx.font = "bold 15px monospace";
          const tw = ctx.measureText(label).width;
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath(); ctx.roundRect(tx - tw / 2 - 5, ty - 11, tw + 10, 22, 4); ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, tx, ty);
          ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
          ctx.fillStyle = ann.color; ctx.globalAlpha = 0.85;
        }
      } else if (ann.type === "circle" && ann.points.length >= 2) {
        const [c, edge] = ann.points;
        const r = Math.hypot((edge.x - c.x) * w, (edge.y - c.y) * h);
        ctx.beginPath(); ctx.arc(c.x * w, c.y * h, r, 0, Math.PI * 2); ctx.stroke();
      } else if (ann.type === "text" && ann.points.length >= 1) {
        ctx.globalAlpha = 1;
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.label || "Text", ann.points[0].x * w, ann.points[0].y * h);
      }

      // Point handles.
      ctx.globalAlpha = 0.8;
      for (const pt of ann.points) {
        ctx.beginPath(); ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = ann.color; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }, [annotations, currentPoints, tool, color, rect]);

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none">
      {/* Video */}
      <video ref={videoRef} src={videoSrc} className="max-w-full max-h-full object-contain" playsInline />

      {/* Drawing overlay — positioned exactly over the video content rect */}
      {rect.width > 0 && (
        <canvas
          ref={canvasRef}
          className="absolute cursor-crosshair touch-none"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      )}

      {/* Inline text input for the text tool */}
      {textDraft && (
        <input
          autoFocus
          value={textDraft.value}
          onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextDraft(null); }}
          className="absolute text-sm px-1 py-0.5 rounded border bg-white text-black"
          style={{ left: rect.left + textDraft.x * rect.width, top: rect.top + textDraft.y * rect.height }}
        />
      )}

      {/* Top toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1">
          {TOOLS.map(t => (
            <Button key={t.type} size="icon" variant={tool === t.type ? "default" : "ghost"}
              className="h-8 w-8 text-white" title={t.title} onClick={() => selectTool(t.type)}>
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div className="w-px h-6 bg-white/20" />
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button key={c} className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-white scale-125" : "border-white/30"}`}
              style={{ backgroundColor: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="w-px h-6 bg-white/20" />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" title="Undo" onClick={undoLast}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" title="Clear all" onClick={clearAnnotations}>
          <Eraser className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" title="Exit" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Bottom playback bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(720px,90vw)] flex items-center gap-3 bg-black/70 rounded-lg px-4 py-2 text-white">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" title="Step back" onClick={() => stepFrame(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white" title="Step forward" onClick={() => stepFrame(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Slider className="flex-1" value={[currentTime]} min={0} max={duration || 1} step={0.001}
          onValueChange={([v]) => seekTo(v)} />
        <span className="text-xs font-mono w-28 text-right">{fmt(currentTime)} / {fmt(duration)}</span>
        <Select value={String(frameStepIndex)} onValueChange={(v) => setFrameStepIndex(Number(v))}>
          <SelectTrigger className="w-[92px] h-8 text-xs text-white border-white/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FRAME_STEPS.map((s, i) => (<SelectItem key={i} value={String(i)}>{s.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/VideoPresentMode.tsx
git commit -m "Add VideoPresentMode fullscreen live-annotation component"
```

---

## Task 4: Wire the Present button into VideoAnalysis

**Files:**
- Modify: `client/src/components/VideoAnalysis.tsx`

- [ ] **Step 1: Import the component and an icon**

In `client/src/components/VideoAnalysis.tsx`, add to the lucide-react import list (line 11-15) the icon `Presentation`, and add a new import after `import AnnotationCanvas from "./AnnotationCanvas";` (line 18):

```tsx
import VideoPresentMode from "./VideoPresentMode";
```

- [ ] **Step 2: Add presenting state**

After the existing `const [isFullscreen, setIsFullscreen] = useState(false);` (line 65), add:

```tsx
  const [presenting, setPresenting] = useState(false);
```

- [ ] **Step 3: Add the Present button**

In the player header actions, immediately after the closing `</Button>` of the Align button block (the `{currentVideoSrc && ( ... Align ... )}` block ending near line 453), add a second `currentVideoSrc`-gated button:

```tsx
              {currentVideoSrc && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setPresenting(true)}
                >
                  <Presentation className="h-3 w-3 mr-1" />Present
                </Button>
              )}
```

- [ ] **Step 4: Render VideoPresentMode**

Just before the final closing `</div>` of the component's returned tree (after the Annotation `Dialog` block near line 812, before line 813 `</div>`), add:

```tsx
      {presenting && currentVideoSrc && (
        <VideoPresentMode
          videoSrc={currentVideoSrc}
          startTime={currentTime}
          onClose={() => setPresenting(false)}
        />
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/VideoAnalysis.tsx
git commit -m "Add Present button to open VideoPresentMode from the video editor"
```

---

## Task 5: Verification

**Files:** none (verification only)

- [ ] **Step 1: Full test + typecheck + build**

Run: `npm run check && npx vitest run && npm run build`
Expected: types clean; all tests pass (existing + 12 new); build succeeds.

- [ ] **Step 2: Manual pass (dev server)**

Run: `npm run dev`, open the app, go to a patient → assessment → Video Analysis, upload a running video, click **Present**. Verify:
  - The view goes fullscreen (browser chrome hidden) with the video centered.
  - Scrub / frame-step to a frame; the frame is shown paused.
  - Draw an **angle** (3 taps): the arc + degree value appear on the frame; the value is sensible (e.g. a right angle ≈ 90°).
  - Draw a **line**, **horizontal**, **vertical**, **circle**; drag a point to adjust.
  - Add a **text** label (type + Enter).
  - Press **Undo** and **Clear**.
  - Scrub or press play → the overlay clears (freeze-frame model).
  - Press **Esc** (or ✕) → returns to the editor; re-open works.

- [ ] **Step 3: Confirm no regressions in the existing annotation flow**

Capture a screenshot and open the normal **Annotate** dialog; draw an angle and confirm the value matches what it showed before this change (shared geometry sanity check).

---

## Notes for the executor
- Present Mode stores points as normalized `[0,1]` within the video content rect; because `object-contain` scales uniformly, drawn angles are preserved across resize/fullscreen.
- Nothing in Present Mode calls tRPC or persists — it is purely a live client-facing aid.
- Line numbers in Task 4 are approximate; anchor edits on the quoted surrounding code, not the numbers.
