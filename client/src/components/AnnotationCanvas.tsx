import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Minus, CornerDownRight, Circle, Type, Trash2, Loader2, Save, Undo2, Grid3X3, MoveHorizontal, MoveVertical, Info, Target } from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

type AnnotationType = "line" | "angle" | "circle" | "text" | "horizontal" | "vertical";
type Point = { x: number; y: number };
type AngleMode = "inner" | "outer" | "supplement";
type DrawingAnnotation = {
  id?: number;
  type: AnnotationType;
  points: Point[];
  color: string;
  label: string;
  metricName?: string;
  measuredValue?: number;
  autoDetected?: boolean;
  useOuterAngle?: boolean;
  angleMode?: AngleMode;
  isNegative?: boolean; // ± flag for varus/inversion/hike/crossover indication
};

interface Props {
  screenshot: any;
  assessmentId: number;
  onClose: () => void;
  onDescriptionUpdate: (desc: string) => void;
}

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];

// Map gait phase enum from DB to metric phase names
const PHASE_MAP: Record<string, string[]> = {
  "foot_strike": ["IC"],
  "loading": ["Loading", "Mid-Stance"],
  "mid_stance": ["Loading", "Mid-Stance"], // treat mid_stance same as loading
  "push_off": ["Toe-Off"],
  "swing": ["Mid-Swing"],
  "other": ["Loading", "Mid-Stance"],
};

// Map view type from DB to metric view names
const VIEW_MAP: Record<string, string> = {
  "side_left": "Side",
  "side_right": "Side",
  "back": "Back",
};

export default function AnnotationCanvas({ screenshot, assessmentId, onClose, onDescriptionUpdate }: Props) {
  const [tool, setTool] = useState<AnnotationType>("angle");
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [currentLabel, setCurrentLabel] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<string>("none");
  const [description, setDescription] = useState(screenshot.description || "");
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSpacing, setGridSpacing] = useState(10);
  const [draggingPoint, setDraggingPoint] = useState<{ annIndex: number; pointIndex: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [footLabelMode, setFootLabelMode] = useState<"L" | "R" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const { data: existingAnnotations } = trpc.annotation.list.useQuery({ screenshotId: screenshot.id });
  const { data: metricsStandards } = trpc.metrics.list.useQuery();
  const { data: assessmentData } = trpc.assessment.get.useQuery({ id: assessmentId });
  const utils = trpc.useUtils();
  const createAnnotation = trpc.annotation.create.useMutation();
  const deleteAnnotation = trpc.annotation.delete.useMutation();
  const updateAssessment = trpc.assessment.update.useMutation();

  // Current screenshot's view and phase
  const currentView = VIEW_MAP[screenshot.viewType] || "Side";
  const currentPhases = PHASE_MAP[screenshot.gaitPhase] || ["Mid-Stance"];

  // Filter and group metrics relevant to this screenshot's view
  const metricOptions = useMemo(() => {
    if (!metricsStandards) return { relevant: [], other: [] };
    const active = metricsStandards.filter((m: any) => m.isActive);

    // Relevant = matches view AND phase
    const relevant = active.filter((m: any) => {
      const matchView = m.view === currentView;
      const matchPhase = currentPhases.includes(m.phase);
      return matchView && matchPhase;
    });

    // Other = matches view but not phase, or all other active metrics
    const relevantIds = new Set(relevant.map((m: any) => m.id));
    const other = active.filter((m: any) => !relevantIds.has(m.id));

    return { relevant, other };
  }, [metricsStandards, currentView, currentPhases]);

  // Get rating for a measured value using Low/Optimal/High scale
  const getRating = useCallback((metricName: string, value: number): { rating: string; color: string; loadShift?: string } => {
    if (!metricsStandards) return { rating: "Unknown", color: "#6b7280" };
    const std = metricsStandards.find((m: any) => m.metricName === metricName);
    if (!std) return { rating: "Unknown", color: "#6b7280" };

    // Check Reference Target first
    if (std.optimalMin != null && std.optimalMax != null && value >= std.optimalMin && value <= std.optimalMax) {
      return { rating: "Ref. Target", color: "#16a34a" };
    }
    // Check Low
    if (std.lowMax != null && value <= std.lowMax) {
      return { rating: "Low", color: "#2874A6", loadShift: std.lowLoadShift || undefined };
    }
    // Check High
    if (std.highMin != null && value >= std.highMin) {
      return { rating: "High", color: "#D68910", loadShift: std.highLoadShift || undefined };
    }
    // Borderline — treat as Ref. Target
    return { rating: "Ref. Target", color: "#16a34a" };
  }, [metricsStandards]);

  // Load existing annotations
  useEffect(() => {
    if (existingAnnotations) {
      const loaded = existingAnnotations.map((a: any) => {
        const data = typeof a.data === "string" ? JSON.parse(a.data) : (a.data || {});
        const subType = data.subType || a.annotationType;
        return {
          id: a.id,
          type: (["line", "angle", "circle", "text", "horizontal", "vertical"].includes(subType) ? subType : a.annotationType) as AnnotationType,
          points: data.points || [],
          color: a.color || COLORS[0],
          label: a.label || "",
          metricName: a.metricName || undefined,
          measuredValue: a.measuredValue ?? undefined,
          autoDetected: data.autoDetected || false,
          useOuterAngle: a.useOuterAngle || false,
          angleMode: (data.angleMode as AngleMode) || (a.useOuterAngle ? "outer" : "inner"),
          isNegative: data.isNegative === true || (a.measuredValue != null && a.measuredValue < 0),
        };
      });
      setAnnotations(loaded);
    }
  }, [existingAnnotations]);

  // Preload image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => {
        imageRef.current = img2;
        setImageNaturalSize({ width: img2.naturalWidth, height: img2.naturalHeight });
        setImageLoaded(true);
      };
      img2.src = screenshot.imageUrl;
    };
    img.src = screenshot.imageUrl;
  }, [screenshot.imageUrl]);

  // Resize observer for canvas container
  useEffect(() => {
    if (!containerRef.current || !imageLoaded) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cw = entry.contentRect.width;
        const ch = entry.contentRect.height;
        if (cw > 0 && imageNaturalSize.width > 0) {
          const imgAspect = imageNaturalSize.width / imageNaturalSize.height;
          const containerAspect = cw / ch;
          let w: number, h: number;
          if (containerAspect > imgAspect) {
            h = ch;
            w = ch * imgAspect;
          } else {
            w = cw;
            h = cw / imgAspect;
          }
          setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageLoaded, imageNaturalSize]);

  // Calculate inner angle between 3 points (always returns the smaller angle 0-180)
  const calculateInnerAngle = useCallback((points: Point[]): number => {
    if (points.length < 3) return 0;
    const [p1, vertex, p2] = points;
    const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
    const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    return (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI;
  }, []);

  // Get effective angle for an annotation based on angleMode
  const getEffectiveAngle = useCallback((ann: DrawingAnnotation): number => {
    const inner = calculateInnerAngle(ann.points);
    const mode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
    if (mode === "outer") return 360 - inner;
    if (mode === "supplement") return Math.abs(180 - inner);
    return inner;
  }, [calculateInnerAngle]);

  // Legacy alias for compatibility
  const calculateAngle = calculateInnerAngle;

  // Draw everything on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded || canvasSize.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);

    // Grid
    if (showGrid) {
      const stepX = canvasSize.width * (gridSpacing / 100);
      const stepY = canvasSize.height * (gridSpacing / 100);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([6, 3]);
      for (let x = stepX; x < canvasSize.width; x += stepX) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize.height); ctx.stroke();
      }
      for (let y = stepY; y < canvasSize.height; y += stepY) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize.width, y); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(canvasSize.width / 2, 0); ctx.lineTo(canvasSize.width / 2, canvasSize.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, canvasSize.height / 2); ctx.lineTo(canvasSize.width, canvasSize.height / 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Reference guide lines when dragging
    if (draggingPoint) {
      const ann = annotations[draggingPoint.annIndex];
      if (ann) {
        const pt = ann.points[draggingPoint.pointIndex];
        const px = pt.x * canvasSize.width;
        const py = pt.y * canvasSize.height;
        const threshold = 0.008;
        let hAligned = false;
        let vAligned = false;
        for (let i = 0; i < ann.points.length; i++) {
          if (i === draggingPoint.pointIndex) continue;
          const op = ann.points[i];
          if (Math.abs(pt.y - op.y) < threshold) hAligned = true;
          if (Math.abs(pt.x - op.x) < threshold) vAligned = true;
        }
        ctx.strokeStyle = hAligned ? "rgba(0, 255, 100, 1)" : "rgba(0, 200, 255, 0.5)";
        ctx.lineWidth = hAligned ? 2.5 : 1;
        ctx.setLineDash(hAligned ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvasSize.width, py); ctx.stroke();
        ctx.strokeStyle = vAligned ? "rgba(0, 255, 100, 1)" : "rgba(0, 200, 255, 0.5)";
        ctx.lineWidth = vAligned ? 2.5 : 1;
        ctx.setLineDash(vAligned ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvasSize.height); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < ann.points.length; i++) {
          if (i === draggingPoint.pointIndex) continue;
          const op = ann.points[i];
          const opx = op.x * canvasSize.width;
          const opy = op.y * canvasSize.height;
          if (Math.abs(pt.y - op.y) < threshold || Math.abs(pt.x - op.x) < threshold) {
            ctx.fillStyle = "rgba(0, 255, 100, 0.8)";
            ctx.beginPath(); ctx.arc(opx, opy, 6, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // Draw annotations
    const allAnns = [...annotations];
    if (currentPoints.length > 0) {
      allAnns.push({ type: tool, points: currentPoints, color, label: currentLabel, metricName: selectedMetric !== "none" ? selectedMetric : undefined });
    }

    for (let ai = 0; ai < allAnns.length; ai++) {
      const ann = allAnns[ai];
      const isSelected = ai === selectedAnnotation;
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash([]);

      // Make lines slightly transparent so anatomy is visible underneath
      ctx.globalAlpha = isSelected ? 0.9 : 0.7;

      if (ann.type === "horizontal" && ann.points.length >= 1) {
        const py = ann.points[0].y * canvasSize.height;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvasSize.width, py); ctx.stroke();
        ctx.setLineDash([]);
      } else if (ann.type === "vertical" && ann.points.length >= 1) {
        const px = ann.points[0].x * canvasSize.width;
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvasSize.height); ctx.stroke();
        ctx.setLineDash([]);
      } else if (ann.type === "line" && ann.points.length >= 2) {
        const [a, b] = ann.points;
        ctx.beginPath();
        ctx.moveTo(a.x * canvasSize.width, a.y * canvasSize.height);
        ctx.lineTo(b.x * canvasSize.width, b.y * canvasSize.height);
        ctx.stroke();
      } else if (ann.type === "angle" && ann.points.length >= 2) {
        for (let i = 0; i < ann.points.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(ann.points[i].x * canvasSize.width, ann.points[i].y * canvasSize.height);
          ctx.lineTo(ann.points[i + 1].x * canvasSize.width, ann.points[i + 1].y * canvasSize.height);
          ctx.stroke();
        }
        if (ann.points.length === 3) {
          const innerAngle = calculateInnerAngle(ann.points);
          const outerAngle = Math.round((360 - innerAngle) * 10) / 10;
          const innerRound = Math.round(innerAngle * 10) / 10;
          const supplementVal = Math.round(Math.abs(180 - innerAngle) * 10) / 10;
          const mode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
          const vertex = ann.points[1];
          const vx = vertex.x * canvasSize.width;
          const vy = vertex.y * canvasSize.height;
          const startAngle = Math.atan2(
            (ann.points[0].y - vertex.y) * canvasSize.height,
            (ann.points[0].x - vertex.x) * canvasSize.width
          );
          const endAngle = Math.atan2(
            (ann.points[2].y - vertex.y) * canvasSize.height,
            (ann.points[2].x - vertex.x) * canvasSize.width
          );

          // Only draw the selected mode's arc and value
          const arcRadius = 20;
          const displayVal = mode === "outer" ? outerAngle : mode === "supplement" ? supplementVal : innerRound;
          
          if (mode === "inner" || mode === "supplement") {
            // Draw inner-side arc
            ctx.beginPath();
            ctx.arc(vx, vy, arcRadius, startAngle, endAngle, innerAngle > 180);
            ctx.stroke();
          } else {
            // Draw outer-side arc
            ctx.beginPath();
            ctx.arc(vx, vy, arcRadius, startAngle, endAngle, !(innerAngle > 180));
            ctx.stroke();
          }

          // Draw the selected value prominently with background
          const innerMidAngle = (startAngle + endAngle) / 2;
          const textAngle = (mode === "outer") 
            ? (innerAngle > 180 ? innerMidAngle : innerMidAngle + Math.PI)
            : (innerAngle > 180 ? innerMidAngle + Math.PI : innerMidAngle);
          const labelText = mode === "supplement" ? `${displayVal}\u00B0` : `${displayVal}\u00B0`;
          const tx = vx + Math.cos(textAngle) * (arcRadius + 16);
          const ty = vy + Math.sin(textAngle) * (arcRadius + 16);
          
          // Background pill for readability
          ctx.font = "bold 13px monospace";
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath();
          const pillW = textWidth + 8;
          const pillH = 18;
          ctx.roundRect(tx - pillW/2, ty - pillH/2, pillW, pillH, 4);
          ctx.fill();
          
          ctx.fillStyle = mode === "supplement" ? "#60a5fa" : "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, tx, ty);
          ctx.textBaseline = "alphabetic";
        }
      } else if (ann.type === "circle" && ann.points.length >= 2) {
        const [center, edge] = ann.points;
        const cx = center.x * canvasSize.width;
        const cy = center.y * canvasSize.height;
        const r = Math.sqrt(
          Math.pow((edge.x - center.x) * canvasSize.width, 2) +
          Math.pow((edge.y - center.y) * canvasSize.height, 2)
        );
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === "text" && ann.points.length >= 1) {
        const pt = ann.points[0];
        const px = pt.x * canvasSize.width;
        const py = pt.y * canvasSize.height;
        // Special rendering for L/R foot labels — large circle with letter
        if ((ann.label === "L" || ann.label === "R") && (ann.color === "#3b82f6" || ann.color === "#ef4444")) {
          const radius = 16;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = ann.color;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.font = "bold 18px sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ann.label, px, py);
          ctx.textBaseline = "alphabetic"; // Reset
        } else {
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = ann.color;
          ctx.textAlign = "left";
          ctx.fillText(ann.label || "Text", px, py);
        }
      }

      ctx.globalAlpha = 1; // Reset after drawing shapes

      // Draw points — small and semi-transparent for accuracy
      for (let pi = 0; pi < ann.points.length; pi++) {
        const pt = ann.points[pi];
        const px = pt.x * canvasSize.width;
        const py = pt.y * canvasSize.height;
        const isDragging = draggingPoint?.annIndex === ai && draggingPoint?.pointIndex === pi;
        const pointRadius = isDragging ? 6 : (isSelected ? 4 : 3);
        ctx.globalAlpha = isDragging ? 0.9 : (isSelected ? 0.7 : 0.5);
        ctx.fillStyle = isDragging ? "#00ff66" : (isSelected ? "#ffffff" : ann.color);
        ctx.beginPath();
        ctx.arc(px, py, pointRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDragging ? "#000" : "rgba(0,0,0,0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = isSelected ? 3 : 2;
      }

      // Label
      if (ann.label && ann.type !== "text" && ann.points.length > 0) {
        const lp = ann.points[0];
        ctx.font = "11px sans-serif";
        ctx.fillStyle = ann.color;
        ctx.textAlign = "left";
        ctx.fillText(ann.label, lp.x * canvasSize.width + 8, lp.y * canvasSize.height - 8);
      }
    }
  }, [annotations, currentPoints, tool, color, currentLabel, selectedMetric, canvasSize, imageLoaded, showGrid, gridSpacing, draggingPoint, selectedAnnotation, calculateInnerAngle]);

  const findNearestPoint = useCallback((clickPt: Point) => {
    const threshold = 25 / Math.max(canvasSize.width, 1); // Larger threshold for touch devices
    let best: { annIndex: number; pointIndex: number; dist: number } | null = null;
    for (let ai = 0; ai < annotations.length; ai++) {
      for (let pi = 0; pi < annotations[ai].points.length; pi++) {
        const pt = annotations[ai].points[pi];
        const dist = Math.sqrt(Math.pow(pt.x - clickPt.x, 2) + Math.pow(pt.y - clickPt.y, 2));
        if (dist < threshold && (!best || dist < best.dist)) {
          best = { annIndex: ai, pointIndex: pi, dist };
        }
      }
    }
    return best;
  }, [annotations, canvasSize.width]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point: Point = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };

    // Foot label mode: place L or R text label and exit mode
    if (footLabelMode) {
      const footAnn: DrawingAnnotation = {
        type: "text",
        points: [point],
        color: footLabelMode === "L" ? "#3b82f6" : "#ef4444",
        label: footLabelMode === "L" ? "L" : "R",
      };
      setAnnotations(prev => [...prev, footAnn]);
      setFootLabelMode(null);
      return;
    }

    // Check if clicking near existing point to drag
    const nearPoint = findNearestPoint(point);
    if (nearPoint && currentPoints.length === 0) {
      setDraggingPoint(nearPoint);
      setSelectedAnnotation(nearPoint.annIndex);
      return;
    }

    // Place new point
    const newPoints = [...currentPoints, point];
    setCurrentPoints(newPoints);

    const neededPoints = tool === "angle" ? 3 : tool === "line" ? 2 : tool === "circle" ? 2 : 1;
    if (newPoints.length >= neededPoints) {
      const angle = tool === "angle" ? calculateInnerAngle(newPoints) : undefined;
      const measuredValue = angle != null ? Math.round(angle * 10) / 10 : undefined;
      const newAnn: DrawingAnnotation = {
        type: tool,
        points: newPoints,
        color,
        label: currentLabel,
        metricName: selectedMetric !== "none" ? selectedMetric : undefined,
        measuredValue,
        useOuterAngle: false,
        angleMode: "inner" as AngleMode,
      };
      setAnnotations(prev => [...prev, newAnn]);
      setCurrentPoints([]);
    }
  }, [currentPoints, tool, color, currentLabel, selectedMetric, findNearestPoint, calculateInnerAngle, footLabelMode]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setAnnotations(prev => {
      const updated = [...prev];
      const ann = { ...updated[draggingPoint.annIndex] };
      const pts = [...ann.points];
      pts[draggingPoint.pointIndex] = { x, y };
      ann.points = pts;
      // Recalculate angle if needed
      if (ann.type === "angle" && pts.length >= 3) {
        const inner = calculateInnerAngle(pts);
        const mode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
        let val: number;
        if (mode === "outer") val = Math.round((360 - inner) * 10) / 10;
        else if (mode === "supplement") val = Math.round(Math.abs(180 - inner) * 10) / 10;
        else val = Math.round(inner * 10) / 10;
        ann.measuredValue = ann.isNegative ? -val : val;
      }
      updated[draggingPoint.annIndex] = ann;
      return updated;
    });
  }, [draggingPoint, calculateInnerAngle]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  const getTouchPoint = useCallback((e: React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.touches[0].clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getTouchPoint(e);
    const nearPoint = findNearestPoint(point);
    if (nearPoint && currentPoints.length === 0) {
      setDraggingPoint(nearPoint);
      setSelectedAnnotation(nearPoint.annIndex);
      return;
    }
    const mouseEvent = { clientX: e.touches[0]?.clientX || 0, clientY: e.touches[0]?.clientY || 0 } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseDown(mouseEvent);
  }, [getTouchPoint, findNearestPoint, currentPoints, handleCanvasMouseDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!draggingPoint) return;
    const mouseEvent = { clientX: e.touches[0]?.clientX || 0, clientY: e.touches[0]?.clientY || 0 } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseMove(mouseEvent);
  }, [draggingPoint, getTouchPoint, handleCanvasMouseMove]);

  const undoLast = () => {
    if (currentPoints.length > 0) { setCurrentPoints([]); }
    else if (annotations.length > 0) { setAnnotations(prev => prev.slice(0, -1)); }
  };

  const removeAnnotation = (index: number) => {
    setAnnotations(prev => prev.filter((_, i) => i !== index));
    if (selectedAnnotation === index) setSelectedAnnotation(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingAnnotations) {
        for (const a of existingAnnotations) {
          await deleteAnnotation.mutateAsync({ id: a.id });
        }
      }
      for (const ann of annotations) {
        await createAnnotation.mutateAsync({
          screenshotId: screenshot.id,
          annotationType: (ann.type === "horizontal" || ann.type === "vertical") ? "line" : ann.type,
          data: { points: ann.points, subType: ann.type, autoDetected: ann.autoDetected, angleMode: ann.angleMode, isNegative: ann.isNegative || false },
          color: ann.color,
          label: ann.label,
          metricName: ann.metricName,
          measuredValue: ann.measuredValue,
          useOuterAngle: ann.useOuterAngle || false,
        });
      }
      onDescriptionUpdate(description);
      utils.annotation.list.invalidate({ screenshotId: screenshot.id });
      toast.success("Annotations saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save annotations");
    } finally {
      setSaving(false);
    }
  };

  const toolButtons: { type: AnnotationType; icon: any; title: string }[] = [
    { type: "angle", icon: CornerDownRight, title: "Measure Angle (3 pts)" },
    { type: "line", icon: Minus, title: "Draw Line (2 pts)" },
    { type: "horizontal", icon: MoveHorizontal, title: "Horizontal Ref Line" },
    { type: "vertical", icon: MoveVertical, title: "Vertical Plumb Line" },
    { type: "circle", icon: Circle, title: "Highlight Circle" },
    { type: "text", icon: Type, title: "Text Label" },
  ];

  // Check which metrics have already been annotated
  const annotatedMetrics = useMemo(() => {
    return new Set(annotations.filter(a => a.metricName).map(a => a.metricName));
  }, [annotations]);

  // iPad-responsive state: detect if narrow viewport
  const [isNarrow, setIsNarrow] = useState(false);
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    const checkWidth = () => {
      const narrow = window.innerWidth < 900;
      setIsNarrow(narrow);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // RESPONSIVE LAYOUT: side-by-side on desktop, stacked on iPad portrait
  return (
    <div className={`flex w-full ${isNarrow ? 'flex-col' : 'flex-row gap-3'}`} style={{ height: 'calc(93vh - 80px)' }}>
      {/* LEFT: Canvas area */}
      <div className={`flex flex-col gap-1 ${isNarrow ? 'flex-none' : 'flex-1 min-w-0 h-full'}`} style={isNarrow ? { height: '55vh' } : undefined}>
        {/* Toolbar — larger touch targets for iPad */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            {toolButtons.map(tb => (
              <Button key={tb.type} variant={tool === tb.type ? "default" : "ghost"} size="sm"
                className="h-9 w-9 p-0 md:h-8 md:w-8 touch-manipulation"
                onClick={() => { setTool(tb.type); setCurrentPoints([]); }} title={tb.title}>
                <tb.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button key={c} className={`w-6 h-6 md:w-5 md:h-5 rounded-full border-2 transition-transform touch-manipulation ${color === c ? "border-foreground scale-125" : "border-muted"}`}
                style={{ backgroundColor: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            {showGrid && (
              <div className="flex items-center gap-1">
                <Slider value={[gridSpacing]} onValueChange={([v]) => setGridSpacing(v)} min={2} max={25} step={1} className="w-20" />
                <span className="text-xs text-muted-foreground w-6">{gridSpacing}%</span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0 md:h-8 md:w-8 touch-manipulation" onClick={undoLast}>
            <Undo2 className="h-4 w-4" />
          </Button>
          {/* L/R foot label buttons for back view */}
          {currentView === "Back" && (
            <div className="flex items-center gap-1 border rounded-lg p-1 ml-1">
              <Button
                variant={footLabelMode === "L" ? "default" : "ghost"}
                size="sm"
                className={`h-9 px-2.5 text-xs font-bold touch-manipulation ${
                  footLabelMode === "L" ? "bg-blue-500 hover:bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50"
                }`}
                onClick={() => setFootLabelMode(footLabelMode === "L" ? null : "L")}
                title="Label Left Foot — tap on image to place"
              >
                L
              </Button>
              <Button
                variant={footLabelMode === "R" ? "default" : "ghost"}
                size="sm"
                className={`h-9 px-2.5 text-xs font-bold touch-manipulation ${
                  footLabelMode === "R" ? "bg-red-500 hover:bg-red-600 text-white" : "text-red-600 hover:bg-red-50"
                }`}
                onClick={() => setFootLabelMode(footLabelMode === "R" ? null : "R")}
                title="Label Right Foot — tap on image to place"
              >
                R
              </Button>
            </div>
          )}
          {isNarrow && (
            <Button variant="outline" size="sm" className="h-9 px-3 touch-manipulation ml-1"
              onClick={() => setShowPanel(!showPanel)}>
              {showPanel ? 'Hide Panel' : `Panel (${annotations.length})`}
            </Button>
          )}
        </div>

        {/* Tool hint */}
        <p className="text-xs text-muted-foreground leading-tight">
          {tool === "line" && "Tap 2 points to draw a line."}
          {tool === "angle" && "Tap 3 points: arm → vertex → arm."}
          {tool === "horizontal" && "Tap to place horizontal reference."}
          {tool === "vertical" && "Tap to place vertical plumb line."}
          {tool === "circle" && "Tap center, then edge."}
          {tool === "text" && "Tap to place text."}
          {currentPoints.length > 0 && ` (${currentPoints.length} placed)`}
          {!footLabelMode && " Drag points to adjust."}
          {footLabelMode && <span className={`font-semibold ${footLabelMode === "L" ? "text-blue-600" : "text-red-600"}`}> Tap on image to place {footLabelMode === "L" ? "Left" : "Right"} foot label.</span>}
        </p>

        {/* Canvas */}
        <div ref={containerRef} className="relative border rounded-lg overflow-hidden bg-black flex items-center justify-center flex-1 min-h-0">
          {!imageLoaded ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          ) : (
            <canvas ref={canvasRef}
              className={`${footLabelMode ? "cursor-pointer" : draggingPoint ? "cursor-grabbing" : "cursor-crosshair"} touch-manipulation`}
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%", touchAction: "none" }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleCanvasMouseUp}
            />
          )}
        </div>
      </div>

      {/* RIGHT: Tools panel — collapsible on iPad, fully scrollable */}
      <div className={`${isNarrow ? (showPanel ? 'flex-1 min-h-0 border-t pt-2 mt-1' : 'hidden') : 'w-72 shrink-0 h-full border-l pl-3'} flex flex-col gap-0 overflow-hidden`}>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {/* Phase & View indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-2 bg-[#1a3a5c]/10 text-[#1a3a5c] border-[#1a3a5c]/20">
            {currentView} View
          </Badge>
          <Badge variant="outline" className="text-xs py-1 px-2 bg-[#D68910]/10 text-[#D68910] border-[#D68910]/20">
            {screenshot.gaitPhase?.replace("_", " ") || "Unknown Phase"}
          </Badge>
        </div>

        {/* Phase-specific metrics checklist */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-[#2874A6]" />
            <Label className="text-sm font-semibold text-[#1a3a5c]">Metrics for this phase</Label>
          </div>
          {metricOptions.relevant.length > 0 ? (
            <div className="space-y-1">
              {metricOptions.relevant.map((m: any) => {
                const isDone = annotatedMetrics.has(m.metricName);
                const isCategory = m.unit === "category";
                if (isCategory) {
                  const isM01 = m.metricId === "M01" || m.metricName === "Overstride Angle";
                  const isM10PushOff = m.metricId === "M10" && m.metricName === "Push-Off Alignment";

                  if (isM01) {
                    // Inline M01 Overstride category picker
                    return (
                      <div key={m.metricName} className="rounded-lg border border-dashed border-[#2874A6]/40 bg-[#2874A6]/5 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs w-8 shrink-0 text-[#2874A6]">{m.metricId || ""}</span>
                          <span className="flex-1 font-medium text-sm text-[#1a3a5c]">{m.metricName}</span>
                          {assessmentData?.overstrideCategory && (
                            <Badge className="text-[9px] px-1.5 py-0" style={{
                              backgroundColor: assessmentData.overstrideCategory === 'optimal' ? '#22c55e'
                                : assessmentData.overstrideCategory === 'understride' ? '#3b82f6'
                                : assessmentData.overstrideCategory === 'mild_overstride' ? '#f59e0b' : '#ef4444',
                              color: '#fff'
                            }}>
                              {assessmentData.overstrideCategory === 'optimal' ? 'Ref. Target'
                                : assessmentData.overstrideCategory === 'understride' ? 'Understride'
                                : assessmentData.overstrideCategory === 'mild_overstride' ? 'Mild Overstride' : 'Overstride'}
                            </Badge>
                          )}
                        </div>
                        <Select value={assessmentData?.overstrideCategory || ""} onValueChange={(v) => {
                          updateAssessment.mutate({ id: assessmentId, overstrideCategory: v }, {
                            onSuccess: () => { utils.assessment.get.invalidate({ id: assessmentId }); toast.success("Overstride category saved"); }
                          });
                        }}>
                          <SelectTrigger className="h-9 text-xs touch-manipulation">
                            <SelectValue placeholder="Select overstride category..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="understride">Understride — foot behind COM</SelectItem>
                            <SelectItem value="optimal">Ref. Target — foot under COM</SelectItem>
                            <SelectItem value="mild_overstride">Mild Overstride</SelectItem>
                            <SelectItem value="overstride">Overstride — excess braking</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px] text-muted-foreground shrink-0">Cadence</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs w-24 touch-manipulation"
                            placeholder="spm"
                            value={assessmentData?.cadence || ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              updateAssessment.mutate({ id: assessmentId, cadence: val } as any, {
                                onSuccess: () => { utils.assessment.get.invalidate({ id: assessmentId }); }
                              });
                            }}
                          />
                          {assessmentData?.cadence && (
                            <span className={`text-[10px] font-medium ${assessmentData.cadence < 160 ? 'text-red-600' : assessmentData.cadence < 170 ? 'text-amber-600' : 'text-green-600'}`}>
                              {assessmentData.cadence < 160 ? 'Low risk' : assessmentData.cadence < 170 ? 'Below avg' : assessmentData.cadence < 180 ? 'Average' : 'Good'}
                            </span>
                          )}
                        </div>
                        {assessmentData?.overstrideCategory && assessmentData?.cadence && assessmentData.cadence < 165 && (assessmentData.overstrideCategory === 'mild_overstride' || assessmentData.overstrideCategory === 'overstride') && (
                          <div className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded p-1.5">
                            ⚠️ Low cadence + overstride = higher braking forces & injury risk
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (isM10PushOff) {
                    // Inline M12 Push-Off Alignment category picker
                    return (
                      <div key={m.metricName} className="rounded-lg border border-dashed border-[#2874A6]/40 bg-[#2874A6]/5 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs w-8 shrink-0 text-[#2874A6]">{m.metricId || ""}</span>
                          <span className="flex-1 font-medium text-sm text-[#1a3a5c]">{m.metricName}</span>
                          {assessmentData?.pushOffCategory && (
                            <Badge className="text-[9px] px-1.5 py-0" style={{
                              backgroundColor: assessmentData.pushOffCategory === 'balanced' ? '#22c55e'
                                : assessmentData.pushOffCategory === 'lateral_push_off' ? '#f59e0b' : '#ef4444',
                              color: '#fff'
                            }}>
                              {assessmentData.pushOffCategory === 'balanced' ? 'Balanced'
                                : assessmentData.pushOffCategory === 'lateral_push_off' ? 'Lateral Push Off' : 'Medial Push Off'}
                            </Badge>
                          )}
                        </div>
                        <Select value={assessmentData?.pushOffCategory || ""} onValueChange={(v) => {
                          updateAssessment.mutate({ id: assessmentId, pushOffCategory: v } as any, {
                            onSuccess: () => { utils.assessment.get.invalidate({ id: assessmentId }); toast.success("Push-off category saved"); }
                          });
                        }}>
                          <SelectTrigger className="h-9 text-xs touch-manipulation">
                            <SelectValue placeholder="Select push-off alignment..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lateral_push_off">Lateral Push Off — foot rolls outward</SelectItem>
                            <SelectItem value="balanced">Balanced — neutral alignment</SelectItem>
                            <SelectItem value="medial_push_off">Medial Push Off — foot rolls inward</SelectItem>
                          </SelectContent>
                        </Select>
                        {m.linesToDraw && <p className="text-[10px] text-muted-foreground">Visual ref: {m.linesToDraw}</p>}
                      </div>
                    );
                  }

                  // Generic fallback for any other category metric
                  return (
                    <div key={m.metricName} className="rounded-lg border border-dashed border-amber-400/40 bg-amber-50 p-3">
                      <span className="text-xs font-semibold text-amber-700">{m.metricId} — Category-based</span>
                    </div>
                  );
                }
                return (
                  <Tooltip key={m.metricName}>
                    <TooltipTrigger asChild>
                      <button
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors touch-manipulation ${
                          isDone
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : selectedMetric === m.metricName
                              ? "bg-[#2874A6]/10 text-[#2874A6] border border-[#2874A6]/30"
                              : "bg-muted/50 hover:bg-muted text-foreground border border-transparent"
                        }`}
                        onClick={() => setSelectedMetric(m.metricName)}
                        onMouseEnter={() => setHoveredMetric(m.metricName)}
                        onMouseLeave={() => setHoveredMetric(null)}
                      >
                        <span className="font-mono font-bold text-xs w-8 shrink-0">{m.metricId || ""}</span>
                        <span className="flex-1 truncate font-medium">{m.metricName}</span>
                        {isDone && <span className="text-green-600 text-sm">✓</span>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-72 p-3">
                      <div className="space-y-1.5">
                        <div className="font-semibold text-sm">{m.metricId} — {m.metricName}</div>
                        {m.whatToMeasure && (
                          <div className="text-xs"><span className="font-medium text-[#2874A6]">Measure:</span> {m.whatToMeasure}</div>
                        )}
                        {m.linesToDraw && (
                          <div className="text-xs"><span className="font-medium text-[#D68910]">Lines to draw:</span> {m.linesToDraw}</div>
                        )}
                        <div className="text-xs flex gap-2 flex-wrap">
                          <span className="text-green-600">Ref. Target: {m.optimalMin}–{m.optimalMax}°</span>
                        </div>
                        {m.lowFinding && (
                          <div className="text-xs"><span className="text-blue-600">Low:</span> {m.lowFinding}</div>
                        )}
                        {m.highFinding && (
                          <div className="text-xs"><span className="text-orange-600">High:</span> {m.highFinding}</div>
                        )}
                        {m.lowLoadShift && m.lowLoadShift !== "—" && (
                          <div className="text-[10px] text-muted-foreground">Low load shift: {m.lowLoadShift}</div>
                        )}
                        {m.highLoadShift && m.highLoadShift !== "—" && (
                          <div className="text-[10px] text-muted-foreground">High load shift: {m.highLoadShift}</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic px-1">No specific metrics for this phase/view combination.</p>
          )}
        </div>

        {/* Other metrics (collapsed) */}
        {metricOptions.other.length > 0 && (
          <details className="space-y-1">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground touch-manipulation py-1">
              Other metrics ({metricOptions.other.length})
            </summary>
            <div className="space-y-1 mt-1">
              {metricOptions.other.map((m: any) => {
                const isDone = annotatedMetrics.has(m.metricName);
                return (
                  <Tooltip key={m.metricName}>
                    <TooltipTrigger asChild>
                      <button
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors touch-manipulation ${
                          isDone
                            ? "bg-green-50 text-green-700"
                            : selectedMetric === m.metricName
                              ? "bg-[#2874A6]/10 text-[#2874A6]"
                              : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                        }`}
                        onClick={() => setSelectedMetric(m.metricName)}
                        onMouseEnter={() => setHoveredMetric(m.metricName)}
                        onMouseLeave={() => setHoveredMetric(null)}
                      >
                        <span className="font-mono font-bold text-[10px] w-8 shrink-0">{m.metricId || ""}</span>
                        <span className="flex-1 truncate">{m.metricName}</span>
                        <span className="text-[10px] shrink-0">{m.view}/{m.phase}</span>
                        {isDone && <span className="text-green-600 text-xs">✓</span>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-72 p-3">
                      <div className="space-y-1.5">
                        <div className="font-semibold text-sm">{m.metricId} — {m.metricName}</div>
                        <div className="text-xs text-muted-foreground">{m.view} View · {m.phase}</div>
                        {m.whatToMeasure && (
                          <div className="text-xs"><span className="font-medium text-[#2874A6]">Measure:</span> {m.whatToMeasure}</div>
                        )}
                        {m.linesToDraw && (
                          <div className="text-xs"><span className="font-medium text-[#D68910]">Lines to draw:</span> {m.linesToDraw}</div>
                        )}
                        <div className="text-xs flex gap-2 flex-wrap">
                          <span className="text-green-600">Ref. Target: {m.optimalMin}–{m.optimalMax}°</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </details>
        )}

        {/* Freehand option */}
        <button
          className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors touch-manipulation ${
            selectedMetric === "none" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50"
          }`}
          onClick={() => setSelectedMetric("none")}
        >
          No metric (freehand)
        </button>

        {/* Drawing hint for hovered/selected metric */}
        {(hoveredMetric || selectedMetric !== 'none') && (() => {
          const targetMetric = hoveredMetric || selectedMetric;
          const m = metricsStandards?.find((ms: any) => ms.metricName === targetMetric);
          if (!m) return null;
          // Category-based metric (M01 Overstride, M12 Push-Off Alignment)
          if (m.unit === "category") {
            const isM10PushOff = m.metricId === "M10" && m.metricName === "Push-Off Alignment";
            const hintText = isM10PushOff
              ? "Rate push-off alignment using the category picker above. You can also draw reference lines on the image for visual assessment."
              : "Rate overstride using the category picker above. You can also draw reference lines on the image for visual assessment.";
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">{m.metricId} — Category-based</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">{hintText}</p>
                {m.linesToDraw && <p className="text-xs text-muted-foreground">Visual reference: {m.linesToDraw}</p>}
              </div>
            );
          }
          if (!m.linesToDraw) return null;
          return (
            <div className="bg-[#2874A6]/5 border border-[#2874A6]/20 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="h-4 w-4 text-[#2874A6]" />
                <span className="text-xs font-semibold text-[#2874A6]">How to draw {m.metricId}</span>
              </div>
              <p className="text-xs text-[#1a3a5c] leading-relaxed">{m.linesToDraw}</p>
              {m.whatToMeasure && (
                <p className="text-xs text-muted-foreground">Measuring: {m.whatToMeasure}</p>
              )}
              <div className="text-xs text-green-600">Ref. Target: {m.optimalMin}–{m.optimalMax}°</div>
            </div>
          );
        })()}

        {/* Label input */}
        <div className="space-y-1">
          <Label className="text-sm font-medium">Label</Label>
          <Input className="h-9 text-sm" placeholder="Optional label..." value={currentLabel} onChange={e => setCurrentLabel(e.target.value)} />
        </div>

        {/* Annotations list */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium text-muted-foreground">Annotations ({annotations.length})</h4>
          <div className="space-y-1">
            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">No annotations yet. Tap on the image to start.</p>
            )}
            {annotations.map((ann, i) => {
              const innerAngle = ann.type === "angle" && ann.points.length >= 3 ? calculateInnerAngle(ann.points) : null;
              const outerAngleRaw = innerAngle !== null ? Math.round((360 - innerAngle) * 10) / 10 : null;
              const innerRoundRaw = innerAngle !== null ? Math.round(innerAngle * 10) / 10 : null;
              const supplementValRaw = innerAngle !== null ? Math.round(Math.abs(180 - innerAngle) * 10) / 10 : null;
              const signMul = ann.isNegative ? -1 : 1;
              const outerAngle = outerAngleRaw !== null ? outerAngleRaw * signMul : null;
              const innerRound = innerRoundRaw !== null ? innerRoundRaw * signMul : null;
              const supplementVal = supplementValRaw !== null ? supplementValRaw * signMul : null;
              const currentMode: AngleMode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
              const displayValue = ann.type === "angle" && innerAngle !== null
                ? (currentMode === "outer" ? outerAngle : currentMode === "supplement" ? supplementVal : innerRound)
                : ann.measuredValue;
              const altValue = null; // No longer needed - mode switcher handles all options
              // Skip numeric rating for category-based metrics (M01 Overstride)
              const metricStd = ann.metricName ? metricsStandards?.find((m: any) => m.metricName === ann.metricName) : null;
              const isCategoryMetric = metricStd?.unit === 'category';
              const ratingInfo = ann.metricName && displayValue != null && !isCategoryMetric && metricStd ? getRating(ann.metricName, displayValue) : null;
              const altRatingInfo = ann.metricName && altValue != null && !isCategoryMetric && metricStd ? getRating(ann.metricName, altValue) : null;
              // Get reference target range for display
              const optRange = metricStd && metricStd.optimalMin != null && metricStd.optimalMax != null
                ? `${metricStd.optimalMin}–${metricStd.optimalMax}°`
                : null;
              return (
                <div key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-lg text-sm cursor-pointer transition-colors touch-manipulation ${selectedAnnotation === i ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted"}`}
                  onClick={() => setSelectedAnnotation(selectedAnnotation === i ? null : i)}>
                  <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: ann.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="capitalize font-medium text-xs">{ann.type}</span>
                      {ann.autoDetected && <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-300 text-blue-600">AI</Badge>}
                      {displayValue != null && <span className="font-mono text-xs font-bold">{displayValue}°</span>}
                      {ratingInfo && (
                        <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: ratingInfo.color, color: "#fff" }}>
                          {ratingInfo.rating}
                        </Badge>
                      )}
                    </div>
                    {ann.metricName && (
                      <div className="text-xs text-primary truncate">
                        {ann.metricName}
                        {isCategoryMetric && <span className="text-amber-600 ml-1">(visual ref only)</span>}
                      </div>
                    )}
                    {/* Show optimal range so user can see if their angle is correct */}
                    {optRange && !isCategoryMetric && displayValue != null && (
                      <div className="text-[10px] text-muted-foreground">Ref. Target: {optRange}</div>
                    )}
                    {ratingInfo?.loadShift && (
                      <div className="text-[10px] text-orange-600 truncate">→ {ratingInfo.loadShift}</div>
                    )}
                    {/* Angle mode switcher for angle annotations */}
                    {ann.type === "angle" && innerAngle !== null && (() => {
                      const currentMode: AngleMode = ann.angleMode || (ann.useOuterAngle ? "outer" : "inner");
                      const sign = ann.isNegative ? -1 : 1;
                      const innerVal = (Math.round(innerAngle * 10) / 10) * sign;
                      const outerVal = (Math.round((360 - innerAngle) * 10) / 10) * sign;
                      const supplementVal = (Math.round(Math.abs(180 - innerAngle) * 10) / 10) * sign;
                      const innerRating = ann.metricName && !isCategoryMetric && metricStd ? getRating(ann.metricName, innerVal) : null;
                      const outerRating = ann.metricName && !isCategoryMetric && metricStd ? getRating(ann.metricName, outerVal) : null;
                      const supplementRating = ann.metricName && !isCategoryMetric && metricStd ? getRating(ann.metricName, supplementVal) : null;

                      const switchMode = (mode: AngleMode) => {
                        setAnnotations(prev => {
                          const updated = [...prev];
                          const a = { ...updated[i] };
                          a.angleMode = mode;
                          a.useOuterAngle = mode === "outer";
                          const inner = calculateInnerAngle(a.points);
                          let val: number;
                          if (mode === "outer") val = Math.round((360 - inner) * 10) / 10;
                          else if (mode === "supplement") val = Math.round(Math.abs(180 - inner) * 10) / 10;
                          else val = Math.round(inner * 10) / 10;
                          a.measuredValue = a.isNegative ? -val : val;
                          updated[i] = a;
                          return updated;
                        });
                      };

                      const toggleSign = () => {
                        setAnnotations(prev => {
                          const updated = [...prev];
                          const a = { ...updated[i] };
                          a.isNegative = !a.isNegative;
                          const inner = calculateInnerAngle(a.points);
                          const m = a.angleMode || (a.useOuterAngle ? "outer" : "inner");
                          let val: number;
                          if (m === "outer") val = Math.round((360 - inner) * 10) / 10;
                          else if (m === "supplement") val = Math.round(Math.abs(180 - inner) * 10) / 10;
                          else val = Math.round(inner * 10) / 10;
                          a.measuredValue = a.isNegative ? -val : val;
                          updated[i] = a;
                          return updated;
                        });
                      };

                      const modes: { mode: AngleMode; label: string; value: number; rating: typeof innerRating; activeColor: string; inactiveColor: string }[] = [
                        { mode: "inner", label: "Inner", value: innerVal, rating: innerRating, activeColor: "bg-gray-200 ring-1 ring-gray-400", inactiveColor: "bg-muted/60 hover:bg-muted" },
                        { mode: "outer", label: "Outer", value: outerVal, rating: outerRating, activeColor: "bg-amber-100 ring-1 ring-amber-400", inactiveColor: "bg-muted/60 hover:bg-muted" },
                        { mode: "supplement", label: "180°", value: supplementVal, rating: supplementRating, activeColor: "bg-blue-100 ring-1 ring-blue-400", inactiveColor: "bg-muted/60 hover:bg-muted" },
                      ];

                      return (
                        <>
                          <div className="mt-1 flex gap-1">
                            {modes.map(({ mode, label, value, rating, activeColor, inactiveColor }) => (
                              <button
                                key={mode}
                                className={`flex-1 flex flex-col items-center gap-0.5 text-[10px] rounded px-1 py-1.5 transition-all touch-manipulation ${
                                  currentMode === mode ? activeColor + " font-bold" : inactiveColor + " opacity-70"
                                }`}
                                onClick={(e) => { e.stopPropagation(); switchMode(mode); }}
                              >
                                <span className="font-medium">{label}</span>
                                <span className="font-mono text-[11px]">{value}°</span>
                                {rating && (
                                  <Badge className="text-[8px] h-3 px-1" style={{ backgroundColor: rating.color, color: "#fff" }}>
                                    {rating.rating}
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                          <button
                            className={`mt-1 w-full flex items-center justify-center gap-1.5 text-[10px] rounded px-2 py-1.5 transition-all touch-manipulation ${
                              ann.isNegative
                                ? "bg-red-100 ring-1 ring-red-400 text-red-700 font-bold"
                                : "bg-muted/60 hover:bg-muted opacity-80"
                            }`}
                            onClick={(e) => { e.stopPropagation(); toggleSign(); }}
                            title="Toggle negative direction (varus, inversion, hip hike, crossover)"
                          >
                            <span className="font-mono text-[12px]">{ann.isNegative ? "−" : "+"}</span>
                            <span className="font-medium">{ann.isNegative ? "Negative direction" : "Positive direction"}</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0 touch-manipulation" onClick={(e) => { e.stopPropagation(); removeAnnotation(i); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-sm font-medium">Screenshot Notes</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe findings..." rows={2} className="text-sm" />
        </div>
        </div>{/* end scrollable area */}

        {/* Actions — sticky at bottom */}
        <div className="flex gap-2 pt-2 border-t mt-2 shrink-0">
          <Button variant="outline" className="flex-1 h-10 touch-manipulation" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-10 bg-[#2874A6] hover:bg-[#1a5276] touch-manipulation" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
