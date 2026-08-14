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
import {
  PLAYBACK_RATES, DEFAULT_PLAYBACK_RATE, clampPlaybackRate, formatPlaybackRate,
} from "@/lib/playbackRate";

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
  const [playbackRate, setPlaybackRate] = useState<number>(DEFAULT_PLAYBACK_RATE);
  // Dropdowns must portal into the fullscreen element; document.body renders behind it.
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState<{ annIndex: number; pointIndex: number } | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeThrottle = useRef(0);
  // Mirrors playbackRate so the loadedmetadata handler can reapply it without re-subscribing.
  const rateRef = useRef(DEFAULT_PLAYBACK_RATE);

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

  // Apply playback speed to the element; browsers keep it across play/pause.
  useEffect(() => {
    const rate = clampPlaybackRate(playbackRate);
    rateRef.current = rate;
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, [playbackRate]);

  // Enter fullscreen on mount; close when the user leaves fullscreen.
  useEffect(() => {
    const el = containerRef.current;
    setPortalHost(el);
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
      // Loading a source resets playbackRate to 1 — restore the user's choice.
      video.playbackRate = rateRef.current;
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
      // Let the dropdowns own space/arrows while they have focus.
      if (e.target instanceof HTMLElement && e.target.closest('[role="combobox"],[role="listbox"]')) return;
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
          const inner = calculateInnerAngle(ann.points);
          const value = Math.round(inner * 10) / 10;
          const vertex = ann.points[1];
          const vx = vertex.x * w;
          const vy = vertex.y * h;
          const startAngle = Math.atan2((ann.points[0].y - vertex.y) * h, (ann.points[0].x - vertex.x) * w);
          const endAngle = Math.atan2((ann.points[2].y - vertex.y) * h, (ann.points[2].x - vertex.x) * w);
          ctx.beginPath(); ctx.arc(vx, vy, 22, startAngle, endAngle, inner > 180); ctx.stroke();
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
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(860px,94vw)] flex items-center gap-3 bg-black/70 rounded-lg px-4 py-2 text-white">
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
        <Select value={String(playbackRate)} onValueChange={(v) => setPlaybackRate(Number(v))}>
          <SelectTrigger className="w-[84px] h-8 text-xs text-white border-white/30" title="Playback speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portalHost}>
            {PLAYBACK_RATES.map(r => (
              <SelectItem key={r} value={String(r)}>{formatPlaybackRate(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(frameStepIndex)} onValueChange={(v) => setFrameStepIndex(Number(v))}>
          <SelectTrigger className="w-[92px] h-8 text-xs text-white border-white/30" title="Frame step size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portalHost}>
            {FRAME_STEPS.map((s, i) => (<SelectItem key={i} value={String(i)}>{s.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
