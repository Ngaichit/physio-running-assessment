import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, FileDown, Wand2, RefreshCw, Pencil, Eye, Save, Plus, Trash2 } from "lucide-react";
import { useState, useRef, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { toast } from "sonner";
// Lazy-load pdfjs (~1.4MB) — only pulled in when a PDF is actually previewed or
// exported, so it lands in its own chunk instead of the main bundle.
const PdfPageRenderer = lazy(() => import("@/components/PdfPageRenderer"));
import { escapeHtml } from "@/report/escape";
// Plain text renderer - replaces Streamdown to prevent markdown/code rendering
// Flatten any value to a plain string. Handles cases where the AI returned
// { title, content } or { text } objects instead of strings.
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.title === "string" && typeof obj.content === "string") return `${obj.title}\n${obj.content}`;
    if (typeof obj.value === "string") return obj.value;
  }
  return "";
}

function PlainText({ children }: { children: unknown }) {
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{asText(children)}</p>;
}

// Split a newline-separated string into clean bullet items.
// Strips leading -, *, •, numbering (1., 1)) so the AI's formatting noise
// doesn't surface in the UI.
function splitBullets(s: unknown): string[] {
  return asText(s)
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*•·]\s*|^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function BulletList({ value }: { value: unknown }) {
  const items = splitBullets(value);
  if (items.length === 0) return null;
  return (
    <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1 text-muted-foreground">
      {items.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  );
}

// Same logic for the printed HTML output.
function bulletListHtml(value: unknown): string {
  const items = asText(value)
    .split(/\r?\n/)
    .map((line: string) => line.replace(/^\s*[-*•·]\s*|^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  return `<ul style="margin:10px 2px 0;padding-left:18px;font-size:10.5px;color:#333;line-height:1.55;list-style-type:disc">${items.map(i => `<li style="margin:2px 0">${escapeHtml(i)}</li>`).join("")}</ul>`;
}

const LOGO_HORIZONTAL = "/logo-horizontal.png";

// ======================== BRAND COLORS ========================
// Extracted from Total Health logo
const BRAND = {
  blue: '#1A6B9C',       // Deep teal-blue (logo text + figure)
  blueDark: '#1E3A5F',   // Deep navy for headings (institute authority)
  blueLight: '#EDF2F7',  // Very light blue for card backgrounds
  orange: '#E8862A',     // Warm orange — risk/attention accent
  orangeLight: '#FEF3E2', // Light orange for backgrounds
  green: '#7A9A3B',      // Olive green — optimal/safe accent
  greenLight: '#F0F5E6', // Light green for backgrounds
  navy: '#1E3A5F',       // Deep navy for headings
  text: '#333333',       // Body text — warm dark
  gray: '#64748B',       // Muted text
  grayLight: '#F6F8FA',  // Warm light grey page background
  white: '#FFFFFF',
};

// Component that renders a screenshot with its annotations drawn on a canvas overlay
function AnnotatedScreenshot({ screenshot }: { screenshot: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { data: annotations } = trpc.annotation.list.useQuery({ screenshotId: screenshot.id });

  useEffect(() => {
    let cancelled = false;
    // Fetch image as blob first to avoid CORS tainted canvas issues with S3 URLs
    (async () => {
      try {
        const resp = await fetch(screenshot.imageUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            imgRef.current = img;
            setImgLoaded(true);
          }
        };
        img.onerror = () => {
          // Fallback: try loading directly with crossOrigin
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = "anonymous";
          fallbackImg.onload = () => {
            if (!cancelled) {
              imgRef.current = fallbackImg;
              setImgLoaded(true);
            }
          };
          fallbackImg.src = screenshot.imageUrl;
        };
        img.src = blobUrl;
      } catch {
        // Fallback: try loading directly with crossOrigin
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = "anonymous";
        fallbackImg.onload = () => {
          if (!cancelled) {
            imgRef.current = fallbackImg;
            setImgLoaded(true);
          }
        };
        fallbackImg.src = screenshot.imageUrl;
      }
    })();
    return () => { cancelled = true; };
  }, [screenshot.imageUrl]);

  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    if (annotations && annotations.length > 0) {
      drawAnnotationsOnCanvas(ctx, canvas.width, canvas.height, annotations);
    }
  }, [imgLoaded, annotations]);

  const viewLabel = (view: string) => {
    switch (view) { case "side_left": return "Left Side"; case "side_right": return "Right Side"; case "back": return "Back View"; default: return view; }
  };
  const phaseLabel = (phase: string) => {
    switch (phase) { case "foot_strike": return "Foot Strike"; case "loading": case "mid_stance": return "Loading"; case "push_off": return "Push Off"; case "swing": return "Swing"; default: return "Other"; }
  };

  return (
    <div className="rounded-lg overflow-hidden border">
      <div className="bg-black flex items-center justify-center" style={{ aspectRatio: "3/4" }}>
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>
      <div className="p-2">
        <p className="text-xs font-medium">
          {viewLabel(screenshot.viewType)} - {phaseLabel(screenshot.gaitPhase)}
          {screenshot.legSide && <span className={`ml-1 font-bold ${screenshot.legSide === 'left' ? 'text-blue-600' : 'text-red-600'}`}>({screenshot.legSide === 'left' ? 'L' : 'R'})</span>}
        </p>
        {screenshot.description && <p className="text-xs text-muted-foreground mt-0.5">{screenshot.description}</p>}
      </div>
    </div>
  );
}

// Convert image URL to base64 data URI for PDF export
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

// Draw all annotations onto a canvas context (shared between AnnotatedScreenshot and PDF export)
function drawAnnotationsOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, annotations: any[]) {
  for (const ann of annotations) {
    const data = typeof ann.data === "string" ? JSON.parse(ann.data) : ann.data;
    const pts = data?.points || [];
    if (pts.length === 0) continue;
    ctx.strokeStyle = ann.color || "#ef4444";
    ctx.lineWidth = Math.max(2, w / 300);
    ctx.fillStyle = ann.color || "#ef4444";
    const annType = data?.subType || ann.annotationType;
    if (annType === "angle" && pts.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      ctx.lineTo(pts[1].x * w, pts[1].y * h);
      ctx.lineTo(pts[2].x * w, pts[2].y * h);
      ctx.stroke();
      for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, Math.max(3, w / 150), 0, Math.PI * 2);
        ctx.fill();
      }
      const vx = pts[1].x * w;
      const vy = pts[1].y * h;
      const mode = data?.angleMode || (ann.useOuterAngle ? "outer" : "inner");
      const dx1 = pts[0].x - pts[1].x, dy1 = pts[0].y - pts[1].y;
      const dx2 = pts[2].x - pts[1].x, dy2 = pts[2].y - pts[1].y;
      const dot = dx1*dx2 + dy1*dy2;
      const cross = dx1*dy2 - dy1*dx2;
      let inner = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
      if (cross < 0) inner = 360 - inner;
      const displayVal = mode === "outer" ? Math.round((360 - inner) * 10) / 10 : mode === "supplement" ? Math.round(Math.abs(180 - inner) * 10) / 10 : Math.round(inner * 10) / 10;
      const fontSize = Math.max(14, w / 40);
      ctx.font = `bold ${fontSize}px monospace`;
      const label = `${displayVal}\u00B0`;
      const tw = ctx.measureText(label).width;
      // Pin pill to left edge of image, vertically aligned with the vertex
      const pillW = tw + 8;
      const pillH = fontSize + 6;
      const padding = Math.max(6, w / 80);
      const pillX = padding;
      const pillY = Math.max(2, Math.min(h - pillH - 2, vy - pillH / 2));
      // Thin connector from pill right edge to vertex
      const prevLineWidth = ctx.lineWidth;
      ctx.lineWidth = Math.max(1, w / 600);
      ctx.strokeStyle = ann.color || "#ef4444";
      ctx.beginPath();
      ctx.moveTo(pillX + pillW, pillY + pillH / 2);
      ctx.lineTo(vx, vy);
      ctx.stroke();
      ctx.lineWidth = prevLineWidth;
      // Pill background
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      // Pill text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, pillX + 4, pillY + pillH / 2);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "start";
    } else if (annType === "horizontal" && pts.length >= 1) {
      // Reference horizontal line: full-width dashed line at the point's y
      ctx.save();
      ctx.setLineDash([Math.max(4, w / 200), Math.max(3, w / 280)]);
      ctx.beginPath();
      ctx.moveTo(0, pts[0].y * h);
      ctx.lineTo(w, pts[0].y * h);
      ctx.stroke();
      ctx.restore();
    } else if (annType === "vertical" && pts.length >= 1) {
      // Reference vertical line: full-height dashed line at the point's x
      ctx.save();
      ctx.setLineDash([Math.max(4, w / 200), Math.max(3, w / 280)]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, 0);
      ctx.lineTo(pts[0].x * w, h);
      ctx.stroke();
      ctx.restore();
    } else if (annType === "line" && pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      ctx.lineTo(pts[1].x * w, pts[1].y * h);
      ctx.stroke();
    } else if (annType === "text" && pts.length >= 1) {
      const px = pts[0].x * w;
      const py = pts[0].y * h;
      if ((ann.label === "L" || ann.label === "R") && (ann.color === "#3b82f6" || ann.color === "#ef4444")) {
        const radius = Math.max(16, w / 30);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = ann.color;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = `bold ${radius * 1.2}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ann.label, px, py);
        ctx.textBaseline = "alphabetic";
      } else {
        const fontSize = Math.max(14, w / 40);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = ann.color || "#ef4444";
        ctx.textAlign = "left";
        ctx.fillText(ann.label || "", px, py);
      }
    } else if (annType === "circle" && pts.length >= 2) {
      const cx = pts[0].x * w;
      const cy = pts[0].y * h;
      const r = Math.sqrt(Math.pow((pts[1].x - pts[0].x) * w, 2) + Math.pow((pts[1].y - pts[0].y) * h, 2));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// Render annotations onto a screenshot image and return as base64 data URI for PDF
async function renderAnnotatedScreenshotBase64(screenshot: any, annotations: any[]): Promise<string> {
  // Fetch image as blob to get a local blob URL — avoids CORS tainted canvas entirely
  return new Promise(async (resolve) => {
    try {
      const resp = await fetch(screenshot.imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      // Do NOT set crossOrigin for blob URLs — it's not needed and can cause issues
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(screenshot.imageUrl); return; }
          ctx.drawImage(img, 0, 0);
          // Draw annotations if any
          if (annotations && annotations.length > 0) {
            drawAnnotationsOnCanvas(ctx, canvas.width, canvas.height, annotations);
          }
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          URL.revokeObjectURL(blobUrl);
          resolve(dataUrl);
        } catch (e) {
          console.error("Canvas export failed:", e);
          URL.revokeObjectURL(blobUrl);
          resolve(screenshot.imageUrl);
        }
      };
      img.onerror = () => {
        console.error("Blob image load failed for:", screenshot.imageUrl);
        URL.revokeObjectURL(blobUrl);
        // Fallback: return raw image as base64 without annotations
        imageToBase64(screenshot.imageUrl).then(resolve);
      };
      img.src = blobUrl;
    } catch (e) {
      console.error("Fetch failed for screenshot:", screenshot.imageUrl, e);
      // Fallback: return raw image as base64 without annotations
      imageToBase64(screenshot.imageUrl).then(resolve);
    }
  });
}

// Generate L vs R asymmetry bar chart SVG
function generateAsymmetryChartSVG(asymmetryData: AsymmetryItem[]): string {
  const items = asymmetryData.filter(a => a.leftValue !== null && a.rightValue !== null);
  if (items.length === 0) return '';

  // Layout
  const width = 720;
  const rowH = 56;
  const headerH = 40;
  const footerH = 32;
  const labelW = 170;       // wide left label gutter
  const valueColW = 56;     // value text column on each side
  const centerGap = 0;
  const barAreaW = (width - labelW - valueColW * 2 - centerGap - 16) / 2;
  const centerX = labelW + valueColW + barAreaW;
  const height = items.length * rowH + headerH + footerH;
  const maxVal = Math.max(
    ...items.flatMap(a => [Math.abs(a.leftValue || 0), Math.abs(a.rightValue || 0)])
  ) * 1.15 || 30;

  // Column headers
  let out = '';
  out += `<text x="${centerX - barAreaW / 2 - valueColW / 2}" y="22" text-anchor="middle" font-size="12" font-family="Inter, sans-serif" fill="${BRAND.blue}" font-weight="700" letter-spacing="2">LEFT</text>`;
  out += `<text x="${centerX + barAreaW / 2 + valueColW / 2}" y="22" text-anchor="middle" font-size="12" font-family="Inter, sans-serif" fill="${BRAND.orange}" font-weight="700" letter-spacing="2">RIGHT</text>`;
  out += `<text x="${labelW - 6}" y="22" text-anchor="end" font-size="10" font-family="Inter, sans-serif" fill="${BRAND.gray}" font-weight="600" letter-spacing="1.5">METRIC</text>`;
  out += `<text x="${width - 6}" y="22" text-anchor="end" font-size="10" font-family="Inter, sans-serif" fill="${BRAND.gray}" font-weight="600" letter-spacing="1.5">DIFF</text>`;

  // Center axis
  out += `<line x1="${centerX}" y1="${headerH - 8}" x2="${centerX}" y2="${height - footerH + 4}" stroke="#cbd5e1" stroke-width="1.2" />`;

  items.forEach((a, i) => {
    const y = i * rowH + headerH;
    const leftAbs = Math.abs(a.leftValue || 0);
    const rightAbs = Math.abs(a.rightValue || 0);
    const leftW = (leftAbs / maxVal) * barAreaW;
    const rightW = (rightAbs / maxVal) * barAreaW;
    const absDiff = a.difference !== null ? Math.abs(a.difference) : null;
    const pct = a.percentDiff !== null && a.percentDiff !== undefined ? Math.abs(a.percentDiff) : null;

    // Row background \u2014 alternating, no rating-based highlight
    const rowBg = i % 2 === 0 ? BRAND.grayLight : 'white';
    out += `<rect x="0" y="${y}" width="${width}" height="${rowH}" fill="${rowBg}" />`;

    // Metric label
    const metricLabel = a.metricName.length > 22 ? a.metricName.substring(0, 21) + '\u2026' : a.metricName;
    out += `<text x="10" y="${y + rowH / 2}" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.navy}" font-weight="600">${escapeHtml(metricLabel)}</text>`;

    // Left bar (extends from centerX to the left)
    const barH = 16;
    const barY = y + rowH / 2 - barH / 2;
    out += `<rect x="${centerX - leftW}" y="${barY}" width="${leftW}" height="${barH}" rx="3" fill="${BRAND.blue}" opacity="0.85" />`;
    out += `<text x="${centerX - leftW - 6}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.blue}" font-weight="700">${a.leftValue}\u00b0</text>`;

    // Right bar (extends from centerX to the right)
    out += `<rect x="${centerX}" y="${barY}" width="${rightW}" height="${barH}" rx="3" fill="${BRAND.orange}" opacity="0.85" />`;
    out += `<text x="${centerX + rightW + 6}" y="${y + rowH / 2}" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.orange}" font-weight="700">${a.rightValue}\u00b0</text>`;

    // Diff column on the right \u2014 degrees on top, % below, neutral grey
    const diffText = absDiff !== null ? `${absDiff}\u00b0` : '\u2014';
    const pctText = pct !== null ? `${pct}%` : '';
    out += `<text x="${width - 8}" y="${y + rowH / 2 - 6}" text-anchor="end" dominant-baseline="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.navy}" font-weight="700">${diffText}</text>`;
    out += `<text x="${width - 8}" y="${y + rowH / 2 + 9}" text-anchor="end" dominant-baseline="middle" font-size="10" font-family="Inter, sans-serif" fill="${BRAND.gray}" font-weight="500">${pctText}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height - footerH + 8}" width="100%" style="max-width:${width}px;height:auto" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

interface Props {
  assessmentId: number;
  formData: any;
}

interface MetricRating {
  metricId?: string;
  metricName: string;
  measuredValue: number;
  unit: string;
  rating: string;
  finding?: string;
  loadShift?: string;
  optimalRange?: string;
  view?: string;
  phase?: string;
  notes: string;
  leftValue?: number | null;
  rightValue?: number | null;
}

interface AsymmetryItem {
  metricName: string;
  leftValue: number | null;
  rightValue: number | null;
  difference: number | null;
  percentDiff: number | null;
  rating: string;
  view?: string;
}

interface ReportData {
  background: string;
  impressionFromTesting: string;
  problems: { title: string; description: string; findings: string[] }[];
  management: {
    runningCues: string;
    gaitRelearning: string;
    mobilityExercises: string;
    strengthExercises: string;
    runningProgramming: string;
  };
  summary: string;
  metricsRatings?: MetricRating[];
  metricsAnalysis?: string;
  asymmetryAnalysis?: string;
  asymmetryData?: AsymmetryItem[];
  dynamoTests?: Array<{
    id: number;
    joint: string;
    movement: string;
    position: string | null;
    leftValue: number | null;
    rightValue: number | null;
    unit: string;
    asymmetryPercent: number | null;
    notes: string | null;
    leftPeakForce?: number | null;
    rightPeakForce?: number | null;
    peakForceUnit?: string | null;
    leftPeakRfd?: number | null;
    rightPeakRfd?: number | null;
    peakRfdUnit?: string | null;
    leftTimeToPeak?: number | null;
    rightTimeToPeak?: number | null;
  }>;
}

export default function ReportPreview({ assessmentId, formData }: Props) {
  const [exporting, setExporting] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: patient } = trpc.patient.get.useQuery(
    { id: formData?.patientId },
    { enabled: !!formData?.patientId }
  );
  const { data: screenshotsList } = trpc.screenshot.list.useQuery({ assessmentId });
  const { data: dynamoTestsList } = trpc.dynamo.list.useQuery({ assessmentId });
  const utils = trpc.useUtils();

  const generateReport = trpc.ai.generateReport.useMutation({
    onSuccess: () => {
      utils.assessment.get.invalidate({ id: assessmentId });
      setIsEditing(false);
      setEditingReport(null);
      toast.success("Report regenerated");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateAssessment = trpc.assessment.update.useMutation({
    onSuccess: () => {
      utils.assessment.get.invalidate({ id: assessmentId });
      toast.success("Report saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const report = useMemo<ReportData | null>(() => {
    if (formData?.reportJson) {
      const parsed = typeof formData.reportJson === "string" ? JSON.parse(formData.reportJson) : formData.reportJson;
      return parsed;
    }
    return null;
  }, [formData?.reportJson]);

  useEffect(() => {
    if (report && isEditing) {
      setEditingReport(structuredClone(report));
    }
  }, [report]);

  const startEditing = useCallback(() => {
    if (report) {
      setEditingReport(structuredClone(report));
      setIsEditing(true);
    }
  }, [report]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditingReport(null);
  }, []);

  const saveEdits = useCallback(async () => {
    if (!editingReport) return;
    setSaving(true);
    try {
      await updateAssessment.mutateAsync({
        id: assessmentId,
        reportJson: editingReport,
      });
      setIsEditing(false);
      setEditingReport(null);
    } finally {
      setSaving(false);
    }
  }, [editingReport, assessmentId]);

  const updateField = useCallback((path: string, value: any) => {
    setEditingReport(prev => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const keys = path.split(".");
      let obj: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (/^\d+$/.test(key)) { obj = obj[parseInt(key)]; } else { obj = obj[key]; }
      }
      const lastKey = keys[keys.length - 1];
      if (/^\d+$/.test(lastKey)) { obj[parseInt(lastKey)] = value; } else { obj[lastKey] = value; }
      return updated;
    });
  }, []);

  const addProblem = useCallback(() => {
    setEditingReport(prev => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      if (!updated.problems) updated.problems = [];
      updated.problems.push({ title: "New Finding", description: "", findings: [] });
      return updated;
    });
  }, []);

  const removeProblem = useCallback((index: number) => {
    setEditingReport(prev => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      updated.problems.splice(index, 1);
      return updated;
    });
  }, []);

  const addFinding = useCallback((problemIndex: number) => {
    setEditingReport(prev => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      if (!updated.problems[problemIndex].findings) updated.problems[problemIndex].findings = [];
      updated.problems[problemIndex].findings.push("");
      return updated;
    });
  }, []);

  const removeFinding = useCallback((problemIndex: number, findingIndex: number) => {
    setEditingReport(prev => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      updated.problems[problemIndex].findings.splice(findingIndex, 1);
      return updated;
    });
  }, []);

  const displayReport = isEditing && editingReport ? editingReport : report;

  const viewLabel = (view: string) => {
    switch (view) {
      case "side_left": return "Left Side";
      case "side_right": return "Right Side";
      case "back": return "Back View";
      default: return view;
    }
  };

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "foot_strike": return "Foot Strike";
      case "loading": case "mid_stance": return "Loading";
      case "push_off": return "Push Off";
      case "swing": return "Swing";
      default: return "Other";
    }
  };

  const { data: defaultPractitioner } = trpc.practitioner.getDefault.useQuery();
  // Fetch the practitioner assigned to this assessment (or fall back to default)
  const { data: selectedPractitioner } = trpc.practitioner.get.useQuery(
    { id: formData?.practitionerId },
    { enabled: !!formData?.practitionerId }
  );
  const reportPractitioner = selectedPractitioner || defaultPractitioner;

  // ======================== PDF EXPORT (Client-side HTML Print) ========================
  // Generate SVG overlay for annotations (no canvas, no CORS issues)
  function generateAnnotationSVG(annotations: any[]): string {
    if (!annotations || annotations.length === 0) return '';
    let svgContent = '';
    for (const ann of annotations) {
      const data = typeof ann.data === 'string' ? JSON.parse(ann.data) : ann.data;
      const pts = data?.points || [];
      if (pts.length === 0) continue;
      const color = ann.color || '#ef4444';
      const annType = data?.subType || ann.annotationType;
      const sw = 0.4; // thin stroke for clean look
      if (annType === 'angle' && pts.length >= 3) {
        // Draw thin angle lines — no white outline
        svgContent += `<line x1="${pts[0].x*100}%" y1="${pts[0].y*100}%" x2="${pts[1].x*100}%" y2="${pts[1].y*100}%" stroke="${color}" stroke-width="${sw}%" />`;
        svgContent += `<line x1="${pts[1].x*100}%" y1="${pts[1].y*100}%" x2="${pts[2].x*100}%" y2="${pts[2].y*100}%" stroke="${color}" stroke-width="${sw}%" />`;
        // Small dots at points
        for (const pt of pts) {
          svgContent += `<circle cx="${pt.x*100}%" cy="${pt.y*100}%" r="0.6%" fill="${color}" />`;
        }
        // Use the STORED angle value — bold text inside a white rounded pill for readability
        const displayVal = ann.measuredValue != null ? Math.round(ann.measuredValue * 10) / 10 : null;
        if (displayVal != null) {
          const label = `${displayVal}\u00B0`;
          const vx = pts[1].x * 100;
          const vy = pts[1].y * 100;
          // Compact pill dimensions (percent of viewBox)
          const boxW = label.length * 5.5 + 3;
          const boxH = 10;
          // Pin pill to the left edge, vertically aligned with the vertex
          const leftMargin = 1.5;
          const lx = leftMargin + boxW / 2;
          const ly = Math.max(boxH / 2 + 0.5, Math.min(99.5 - boxH / 2, vy));
          // Thin dashed connector from pill right edge to vertex
          const pillRightX = leftMargin + boxW;
          svgContent += `<line x1="${pillRightX}%" y1="${ly}%" x2="${vx}%" y2="${vy}%" stroke="${color}" stroke-width="0.2%" stroke-dasharray="0.6,0.6" />`;
          // Compact white rounded-rect pill with colored border
          svgContent += `<rect x="${lx - boxW / 2}%" y="${ly - boxH / 2}%" width="${boxW}%" height="${boxH}%" rx="2" ry="2" fill="white" fill-opacity="0.96" stroke="${color}" stroke-width="0.3%" />`;
          svgContent += `<text x="${lx}%" y="${ly}%" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="8%" font-weight="900" font-family="Arial, sans-serif">${label}</text>`;
        }
      } else if (annType === 'horizontal' && pts.length >= 1) {
        // Reference horizontal line: full width at the point's y
        svgContent += `<line x1="0" y1="${pts[0].y*100}%" x2="100%" y2="${pts[0].y*100}%" stroke="${color}" stroke-width="${sw}%" stroke-dasharray="1,0.6" />`;
      } else if (annType === 'vertical' && pts.length >= 1) {
        // Reference vertical line: full height at the point's x
        svgContent += `<line x1="${pts[0].x*100}%" y1="0" x2="${pts[0].x*100}%" y2="100%" stroke="${color}" stroke-width="${sw}%" stroke-dasharray="1,0.6" />`;
      } else if (annType === 'line' && pts.length >= 2) {
        svgContent += `<line x1="${pts[0].x*100}%" y1="${pts[0].y*100}%" x2="${pts[1].x*100}%" y2="${pts[1].y*100}%" stroke="${color}" stroke-width="${sw}%" />`;
      } else if (annType === 'text' && pts.length >= 1) {
        const px = pts[0].x * 100;
        const py = pts[0].y * 100;
        if ((ann.label === 'L' || ann.label === 'R') && (ann.color === '#3b82f6' || ann.color === '#ef4444')) {
          svgContent += `<circle cx="${px}%" cy="${py}%" r="3.5%" fill="${color}" opacity="0.85" />`;
          svgContent += `<text x="${px}%" y="${py}%" text-anchor="middle" dominant-baseline="central" fill="white" font-size="4%" font-weight="bold" font-family="sans-serif">${ann.label}</text>`;
        } else {
          svgContent += `<text x="${px}%" y="${py}%" fill="${color}" font-size="3.5%" font-weight="bold" font-family="sans-serif">${ann.label || ''}</text>`;
        }
      } else if (annType === 'circle' && pts.length >= 2) {
        const cx = pts[0].x * 100;
        const cy = pts[0].y * 100;
        const dx = (pts[1].x - pts[0].x) * 100;
        const dy = (pts[1].y - pts[0].y) * 100;
        const r = Math.sqrt(dx*dx + dy*dy);
        svgContent += `<circle cx="${cx}%" cy="${cy}%" r="${r}%" fill="none" stroke="${color}" stroke-width="${sw}%" />`;
      }
    }
    return svgContent;
  }

  const handleExportPDF = async () => {
    setExporting(true);
    // Open the tab synchronously on click — the browser's popup blocker kills
    // window.open once the click's user activation expires (~5s), and the prep
    // below (annotation fetches + PDF rendering) can easily take longer.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups for this site.");
      setExporting(false);
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Preparing report…</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1A6B9C">
<div style="text-align:center"><div style="font-size:15px;font-weight:600">Preparing report…</div>
<div style="font-size:12px;color:#64748b;margin-top:8px">Rendering screenshots and PDF pages. This can take a little while.</div></div>
</body></html>`);
    printWindow.document.close();
    try {
      toast.info("Preparing report for print... Rendering screenshots.", { duration: 60000, id: "pdf-prep" });

      // Fetch annotations for all screenshots and render image + annotations
      // onto a single canvas — matches the on-screen preview style exactly
      // (same drawAnnotationsOnCanvas function used by AnnotatedScreenshot).
      const screenshotAnnotations: { screenshot: any; annotations: any[]; base64: string }[] =
        screenshotsList && screenshotsList.length > 0
          ? await Promise.all(
              screenshotsList.map(async (ss: any) => {
                let anns: any[] = [];
                try {
                  anns = (await utils.annotation.list.fetch({ screenshotId: ss.id })) || [];
                } catch {
                  anns = [];
                }
                const base64 = await renderAnnotatedScreenshotBase64(ss, anns);
                return { screenshot: ss, annotations: anns, base64 };
              })
            )
          : [];

      // Convert logo to base64
      const logoBase64 = await imageToBase64(LOGO_HORIZONTAL);

      // Render InBody and VO2 PDF pages to images entirely in the browser
      // (pdfjs-dist — no server pdftoppm dependency). Failures surface as toasts.
      let inbodyImages: string[] = [];
      let vo2Images: string[] = [];
      // Dynamic import keeps pdfjs out of the main bundle — loaded once here and
      // reused for both the InBody and VO2 renders below.
      const { renderPdfToBase64Images } = await import("@/components/PdfPageRenderer");
      if (formData?.inbodyFileUrl) {
        try {
          inbodyImages = await renderPdfToBase64Images(formData.inbodyFileUrl, 1.5, 5);
          if (inbodyImages.length === 0) {
            toast.warning("InBody PDF rendered 0 pages — check the uploaded file.");
          }
        } catch (err: any) {
          toast.error(`InBody PDF render failed: ${err?.message || "unknown error"}`);
        }
      }
      if (formData?.vo2FileUrl) {
        try {
          vo2Images = await renderPdfToBase64Images(formData.vo2FileUrl, 1.5, 5);
          if (vo2Images.length === 0) {
            toast.warning("VO2 PDF rendered 0 pages — check the uploaded file.");
          }
        } catch (err: any) {
          toast.error(`VO2 PDF render failed: ${err?.message || "unknown error"}`);
        }
      }

      // Build the asymmetry chart SVG
      const asymSvg = displayReport?.asymmetryData ? generateAsymmetryChartSVG(displayReport.asymmetryData) : '';

      // Build the full HTML report
      const patientName = patient ? patient.name : 'Unknown';
      // String-path escaping: esc() for plain values, escText() for AI text
      // that first flows through asText(). Used ONLY in the document.write template.
      const esc = escapeHtml;
      const escText = (v: unknown) => escapeHtml(asText(v));
      const practitionerName = reportPractitioner?.name || '';
      const today = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
      const assessDate = formData?.assessmentDate ? new Date(formData.assessmentDate).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }) : today;

      // Group screenshots by gait phase, pairing L and R side-by-side.
      // Annotations are already baked into base64 \u2014 no SVG overlay needed.
      const screenshotRowsHtml = (() => {
        const cardData = screenshotAnnotations.map(({ screenshot: ss, base64 }) => {
          const view = ss.viewType === 'side_left' ? 'Left Side' : ss.viewType === 'side_right' ? 'Right Side' : ss.viewType === 'back' ? 'Back View' : ss.viewType;
          const phase = ss.gaitPhase === 'foot_strike' ? 'Foot Strike' : ss.gaitPhase === 'loading' || ss.gaitPhase === 'mid_stance' ? 'Loading' : ss.gaitPhase === 'push_off' ? 'Push Off' : ss.gaitPhase === 'swing' ? 'Swing' : ss.gaitPhase;
          const html = `<div class="ss-card">
            <div class="ss-img-wrap">
              <img src="${base64}" alt="${esc(view)} - ${esc(phase)}" />
            </div>
            <div class="ss-label">${esc(view)} \u2014 ${esc(phase)}${ss.description ? ': ' + esc(ss.description) : ''}</div>
          </div>`;
          return { gaitPhase: ss.gaitPhase, viewType: ss.viewType, phase, html };
        });

        // Group by gait phase — pair left+right of same phase together
        const phaseOrder = ['foot_strike', 'loading', 'mid_stance', 'push_off', 'swing'];
        const phaseGroups = new Map<string, typeof cardData>();
        for (const c of cardData) {
          const key = c.gaitPhase || 'other';
          if (!phaseGroups.has(key)) phaseGroups.set(key, []);
          phaseGroups.get(key)!.push(c);
        }

        let rows = '';
        // Process in phase order first, then any remaining
        const processedPhases = new Set<string>();
        for (const phaseKey of phaseOrder) {
          if (phaseGroups.has(phaseKey)) {
            const group = phaseGroups.get(phaseKey)!;
            processedPhases.add(phaseKey);
            // Sort: left first, then right, then back, then others
            const sortOrder: Record<string, number> = { 'side_left': 0, 'side_right': 1, 'back': 2 };
            group.sort((a, b) => (sortOrder[a.viewType] ?? 3) - (sortOrder[b.viewType] ?? 3));
            // Pair into rows of 2
            for (let i = 0; i < group.length; i += 2) {
              const pair = group.slice(i, i + 2).map(c => c.html).join('');
              const phaseTitle = group[0].phase;
              rows += `<div class="ss-phase-group"><div class="ss-phase-title">${esc(phaseTitle)}</div><div class="ss-row">${pair}</div></div>`;
            }
          }
        }
        // Any remaining phases not in the standard order
        Array.from(phaseGroups.entries()).forEach(([phaseKey, group]) => {
          if (processedPhases.has(phaseKey)) return;
          for (let i = 0; i < group.length; i += 2) {
            const pair = group.slice(i, i + 2).map((c: { html: string }) => c.html).join('');
            const phaseTitle = group[0].phase;
            rows += `<div class="ss-phase-group"><div class="ss-phase-title">${esc(phaseTitle)}</div><div class="ss-row">${pair}</div></div>`;
          }
        });
        return rows;
      })();

      // Metrics table HTML
      const metricsTableHtml = displayReport?.metricsRatings && displayReport.metricsRatings.length > 0 ? `
        <div class="section">
          <h2>10-Metric Running Assessment</h2>
          <table>
            <thead>
              <tr>
                <th style="width:35px">ID</th>
                <th>Metric</th>
                <th style="width:45px">View</th>
                <th style="width:55px">Phase</th>
                <th style="width:50px">Left</th>
                <th style="width:50px">Right</th>
                <th style="width:50px">Average</th>
                <th style="width:75px">Reference Range</th>
                <th style="width:70px">Risk Rating</th>
                <th>Load Implication</th>
              </tr>
            </thead>
            <tbody>
              ${formData?.cadence ? `<tr class="even" style="background:${BRAND.blueLight}">
                <td class="mono" style="color:${BRAND.navy};font-weight:700;font-size:10px">\u2014</td>
                <td style="font-weight:600;font-family:Inter,sans-serif;font-size:10px">Cadence</td>
                <td class="center muted" style="font-size:9px">\u2014</td>
                <td class="center muted" style="font-size:9px">\u2014</td>
                <td class="center mono" colspan="2" style="font-weight:600">${formData.cadence} spm</td>
                <td class="center mono" style="font-weight:600">${formData.cadence} spm</td>
                <td class="center mono muted" style="font-size:9px">170\u2013180 spm</td>
                <td class="center"><span class="${formData.cadence >= 170 && formData.cadence <= 180 ? 'rating-optimal' : formData.cadence < 170 ? 'rating-low' : 'rating-high'}">${formData.cadence >= 170 && formData.cadence <= 180 ? 'Ref. Target' : formData.cadence < 170 ? 'Low' : 'High'}</span></td>
                <td style="color:${BRAND.text};font-size:9.5px">${formData.cadence < 170 ? '\u2191 Ground contact time' : formData.cadence > 180 ? '\u2191 Metabolic cost' : '\u2014'}</td>
              </tr>` : ''}
              ${displayReport.metricsRatings.map((r: MetricRating, i: number) => {
                const isCategory = r.unit === 'category';
                const hasLR = r.leftValue != null || r.rightValue != null;
                const ratingClass = (r.rating === 'Optimal' || r.rating === 'Ref. Target') ? 'rating-optimal' : r.rating === 'Low' ? 'rating-low' : r.rating === 'High' ? 'rating-high' : 'rating-na';
                return `<tr class="${(i + (formData?.cadence ? 1 : 0)) % 2 === 0 ? 'even' : ''}">
                  <td class="mono" style="color:${BRAND.navy};font-weight:700;font-size:10px">${esc(r.metricId || '')}</td>
                  <td style="font-weight:600;font-family:Inter,sans-serif;font-size:10px">${esc(r.metricName)}</td>
                  <td class="center muted" style="font-size:9px">${esc(r.view || '')}</td>
                  <td class="center muted" style="font-size:9px">${esc(r.phase || '')}</td>
                  <td class="center mono" style="color:${BRAND.blue};font-weight:600">${hasLR && r.leftValue != null ? r.leftValue + '\u00b0' : '\u2014'}</td>
                  <td class="center mono" style="color:${BRAND.orange};font-weight:600">${hasLR && r.rightValue != null ? r.rightValue + '\u00b0' : '\u2014'}</td>
                  <td class="center mono" style="font-weight:600">${r.rating === 'Not Measured' ? '\u2014' : isCategory ? esc(r.rating) : r.measuredValue + '\u00b0'}</td>
                  <td class="center mono muted" style="font-size:9px">${esc(r.optimalRange || '')}</td>
                  <td class="center"><span class="${ratingClass}">${r.rating === 'Optimal' ? 'Ref. Target' : esc(r.rating)}</span></td>
                  <td style="color:${BRAND.text};font-size:9.5px">${isCategory && r.finding ? esc(r.finding) : (r.loadShift && r.loadShift !== '\u2014' ? esc(r.loadShift) : '\u2014')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          ${displayReport.metricsAnalysis ? bulletListHtml(displayReport.metricsAnalysis) : ''}
        </div>` : '';

      // Asymmetry section HTML \u2014 chart only, table removed per design decision
      const asymmetryHtml = displayReport?.asymmetryData && displayReport.asymmetryData.length > 0 && asymSvg
        ? `<div class="section">
            <h2>Left vs Right Asymmetry</h2>
            <div style="text-align:center;margin:8px 0">${asymSvg}</div>
            ${displayReport.asymmetryAnalysis ? bulletListHtml(displayReport.asymmetryAnalysis) : ''}
          </div>`
        : '';

      // Dynamo strength table HTML
      const dynamoData = displayReport?.dynamoTests || dynamoTestsList || [];
      const dynamoHtml = dynamoData.length > 0 ? (() => {
        const grouped: Record<string, typeof dynamoData> = {};
        for (const t of dynamoData) { if (!grouped[t.joint]) grouped[t.joint] = []; grouped[t.joint]!.push(t); }
        return `<div class="section">
          <h2>Strength Assessment (VALD Dynamo)</h2>
          ${Object.entries(grouped).map(([joint, tests]) => {
            const calcAsym = (l: number | null | undefined, r: number | null | undefined) => { if (l == null || r == null || (l === 0 && r === 0)) return null; const max = Math.max(l, r), min = Math.min(l, r); return max > 0 ? Math.round(((max - min) / max) * 100) : null; };
            return `<h3 style="color:${BRAND.blue};font-size:13px;margin:10px 0 4px">${esc(joint)}</h3>
              <table>
                <thead><tr><th>Movement</th><th>Measure</th><th style="width:55px">Left</th><th style="width:55px">Right</th><th style="width:45px">Unit</th><th style="width:65px">Asymmetry</th></tr></thead>
                <tbody>${(tests as any[]).map((t: any) => {
                  const pfAsym = calcAsym(t.leftPeakForce, t.rightPeakForce);
                  const rfdAsym = calcAsym(t.leftPeakRfd, t.rightPeakRfd);
                  const ttpAsym = calcAsym(t.leftTimeToPeak, t.rightTimeToPeak);
                  const rows = [
                    { label: 'Mean Force', l: t.leftValue, r: t.rightValue, unit: t.unit, asym: t.asymmetryPercent },
                    { label: 'Peak Force', l: t.leftPeakForce, r: t.rightPeakForce, unit: t.peakForceUnit || 'N', asym: pfAsym },
                    { label: 'Peak RFD', l: t.leftPeakRfd, r: t.rightPeakRfd, unit: t.peakRfdUnit || 'N/s', asym: rfdAsym },
                    { label: 'Time to Peak', l: t.leftTimeToPeak, r: t.rightTimeToPeak, unit: 'ms', asym: ttpAsym },
                  ].filter(row => row.l != null || row.r != null);
                  return rows.map((row, ri) => `<tr class="${ri === 0 ? 'even' : ''}">
                    ${ri === 0 ? `<td rowspan="${rows.length}" style="font-weight:600;vertical-align:top">${esc(t.movement)}${t.position ? `<br><span class="muted" style="font-size:9px">(${esc(t.position)})</span>` : ''}</td>` : ''}
                    <td class="muted">${row.label}</td>
                    <td class="center mono">${row.l != null ? row.l : '\u2014'}</td>
                    <td class="center mono">${row.r != null ? row.r : '\u2014'}</td>
                    <td class="center muted">${esc(row.unit)}</td>
                    <td class="center"><span class="${row.asym != null ? (row.asym <= 10 ? 'rating-optimal' : row.asym <= 15 ? 'rating-low' : 'rating-high') : ''}">${row.asym != null ? row.asym + '%' : '\u2014'}</span></td>
                  </tr>`).join('');
                }).join('')}</tbody>
              </table>`;
          }).join('')}
        </div>`;
      })() : '';

      // Problems / Key Findings HTML
      const problemsHtml = displayReport?.problems && displayReport.problems.length > 0 ? `
        <div class="section">
          <h2>Key Findings</h2>
          <div style="display:grid;grid-template-columns:1fr;gap:12px">
          ${displayReport.problems.map((p: any) => `
            <div class="finding-card">
              <h3>${escText(p.title)}</h3>
              <p>${escText(p.description)}</p>
              ${p.findings && p.findings.length > 0 ? `<ul>${p.findings.map((f: any) => `<li>${escText(f)}</li>`).join('')}</ul>` : ''}
            </div>
          `).join('')}
          </div>
        </div>` : '';

      // Management sections HTML
      const mgmt = displayReport?.management;
      // Combine legacy runningCues + gaitRelearning into one Gait Relearning section
      const combinedGaitRelearning = [asText(mgmt?.runningCues), asText(mgmt?.gaitRelearning)]
        .filter(Boolean)
        .join('\n');
      const mgmtSections = [
        { label: 'Gait Relearning', content: combinedGaitRelearning, color: BRAND.blue },
        { label: 'Mobility Exercises', content: asText(mgmt?.mobilityExercises), color: BRAND.orange },
        { label: 'Strength Exercises', content: asText(mgmt?.strengthExercises), color: '#8B5CF6' },
        { label: 'Running Programming', content: asText(mgmt?.runningProgramming), color: '#6366F1' },
      ].filter(s => s.content);
      // managementHtml is now inlined in the HTML template with disclaimer paragraph

      // Build testing conditions string for cover page
      const conditionsParts: string[] = [];
      if (formData?.assessmentSpeed) conditionsParts.push(`Speed: ${formData.assessmentSpeed}`);
      if (formData?.assessmentIncline) conditionsParts.push(`Incline: ${formData.assessmentIncline}`);
      if (formData?.assessmentFootwear) conditionsParts.push(`Footwear: ${formData.assessmentFootwear}`);
      if (formData?.assessmentRecording) conditionsParts.push(`Recording: ${formData.assessmentRecording}`);
      const conditionsStr = conditionsParts.join(' \u2022 ');

      // Full HTML document
      const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Running Assessment Report - ${esc(patientName)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', 'Source Sans Pro', -apple-system, sans-serif; font-size: 11px; color: ${BRAND.text}; line-height: 1.6; background: ${BRAND.grayLight}; }
  @page {
    size: A4;
    margin: 20mm 18mm 24mm 18mm;
    @bottom-left {
      content: "TOTAL HEALTH";
      font-family: 'Inter', sans-serif;
      font-size: 9px;
      color: ${BRAND.navy};
      font-weight: 700;
      letter-spacing: 2.5px;
      vertical-align: top;
      padding-top: 8mm;
    }
    @bottom-right {
      content: "RUNNING PERFORMANCE ASSESSMENT";
      font-family: 'Inter', sans-serif;
      font-size: 9px;
      color: ${BRAND.gray};
      font-weight: 500;
      letter-spacing: 2px;
      vertical-align: top;
      padding-top: 8mm;
    }
  }
  /* Suppress footer on cover page (first page) — it has its own bottom bar */
  @page :first {
    margin: 0;
    @bottom-left { content: none; }
    @bottom-right { content: none; }
  }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
  }

  /* ===== TYPOGRAPHY ===== */
  h1, h2, h3, h4 { font-family: 'Inter', -apple-system, sans-serif; color: ${BRAND.navy}; }
  .mono { font-family: 'Roboto Mono', 'SF Mono', 'Consolas', monospace; }

  /* ===== COVER PAGE ===== */
  .cover {
    page-break-after: always;
    height: 100vh;
    display: flex; flex-direction: column;
    background: white;
    overflow: hidden;
    position: relative;
    padding: 0;
  }
  .cover-top {
    flex: 1; display: flex; flex-direction: row; align-items: stretch;
  }
  .cover-left {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 60px 48px 60px;
  }
  .cover-left img { width: 180px; margin-bottom: 32px; }
  .cover-left h1 {
    font-size: 28px; font-weight: 800; color: ${BRAND.navy};
    letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 10px;
    text-transform: uppercase;
  }
  .cover-left .subtitle {
    font-size: 13px; color: ${BRAND.gray}; font-weight: 400;
    letter-spacing: 0.5px;
  }
  .cover-right {
    width: 240px; background: ${BRAND.grayLight}; border-radius: 0 0 0 16px;
    padding: 60px 24px; display: flex; flex-direction: column; justify-content: center;
  }
  .cover-right .info-item { margin-bottom: 16px; }
  .cover-right .info-label {
    font-family: 'Inter', sans-serif; font-size: 7px; text-transform: uppercase;
    letter-spacing: 1.5px; color: ${BRAND.gray}; font-weight: 600; margin-bottom: 3px;
  }
  .cover-right .info-value {
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; color: ${BRAND.navy};
  }
  .cover-bottom {
    padding: 20px 48px;
    background: ${BRAND.navy};
    display: flex; justify-content: space-between; align-items: center;
  }
  .cover-bottom span {
    font-family: 'Inter', sans-serif; font-size: 8px; text-transform: uppercase;
    letter-spacing: 1.5px; color: rgba(255,255,255,0.6); font-weight: 500;
  }
  .cover-stripe {
    position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, ${BRAND.orange} 0%, ${BRAND.orange} 50%, ${BRAND.green} 50%, ${BRAND.green} 100%);
  }

  /* ===== PAGE HEADER & FOOTER ===== */
  .page-header {
    border-top: 3px solid ${BRAND.navy};
    padding: 14px 0 22px;
    margin-bottom: 36px;
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 24px;
  }
  .page-header .header-left {
    font-family: 'Inter', sans-serif; font-size: 10px; text-transform: uppercase;
    letter-spacing: 3px; color: ${BRAND.navy}; font-weight: 700;
  }
  .page-header .header-right {
    font-family: 'Inter', sans-serif; font-size: 10px; text-transform: uppercase;
    letter-spacing: 2px; color: ${BRAND.gray}; font-weight: 500;
  }

  /* ===== SECTIONS ===== */
  .section { margin-bottom: 28px; page-break-inside: avoid; break-inside: avoid; }
  /* Never break right after a heading — keep at least the first line of content with it */
  h1, h2, h3, h4 { break-after: avoid-page; page-break-after: avoid; }
  /* Don't orphan content right above a heading either */
  .section > *:first-child { break-after: avoid-page; page-break-after: avoid; }
  /* Tables and table parts shouldn't split a row across pages */
  table, tr, thead, tbody { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .section h2 {
    font-size: 16px; font-weight: 700; color: ${BRAND.navy};
    padding-bottom: 6px; margin-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    position: relative;
  }
  .section h2::before {
    content: ''; position: absolute; bottom: -1px; left: 0;
    width: 6px; height: 6px; border-radius: 50%;
    background: ${BRAND.orange};
  }
  .section h3 {
    font-size: 12px; font-weight: 600; color: ${BRAND.navy};
    margin: 16px 0 8px;
  }

  /* ===== TABLES ===== */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
  thead tr { background: ${BRAND.navy}; color: white; }
  th {
    padding: 8px 8px; text-align: left; font-family: 'Inter', sans-serif;
    font-weight: 600; font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px;
  }
  td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; }
  tr.even { background: ${BRAND.grayLight}; }
  .center { text-align: center; }
  .muted { color: ${BRAND.gray}; }

  /* ===== RATING BADGES ===== */
  .rating-optimal {
    background: ${BRAND.green}18; color: ${BRAND.green}; padding: 3px 8px;
    border-radius: 4px; font-weight: 700; font-size: 8px; font-family: 'Inter', sans-serif;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .rating-low {
    background: ${BRAND.orange}18; color: ${BRAND.orange}; padding: 3px 8px;
    border-radius: 4px; font-weight: 700; font-size: 8px; font-family: 'Inter', sans-serif;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .rating-high {
    background: #dc262618; color: #dc2626; padding: 3px 8px;
    border-radius: 4px; font-weight: 700; font-size: 8px; font-family: 'Inter', sans-serif;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .rating-na {
    background: #f1f5f9; color: ${BRAND.gray}; padding: 3px 8px;
    border-radius: 4px; font-size: 8px; font-family: 'Inter', sans-serif;
  }

  /* ===== SCREENSHOT GRID ===== */
  .ss-phase-group { page-break-inside: avoid; }
  .ss-phase-title {
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700;
    color: ${BRAND.navy}; text-transform: uppercase; letter-spacing: 1px;
    margin: 20px 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
    page-break-after: avoid;
  }
  .ss-phase-title:first-child { margin-top: 0; }
  .ss-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px; page-break-inside: avoid; }
  .ss-card {
    background: white; border-radius: 8px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06); page-break-inside: avoid;
  }
  .ss-img-wrap { position: relative; background: white; }
  .ss-card img { width: 100%; display: block; }
  .ss-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  .ss-label {
    padding: 6px 10px; font-size: 9px; color: ${BRAND.text};
    background: ${BRAND.grayLight}; font-weight: 500;
    font-family: 'Inter', sans-serif;
  }

  /* ===== FINDING CARDS ===== */
  .finding-card {
    background: white; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 16px 20px; margin-bottom: 12px; page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    border-left: 4px solid ${BRAND.orange};
  }
  .finding-card h3 {
    margin: 0 0 6px; font-size: 13px; color: ${BRAND.navy};
    font-family: 'Inter', sans-serif; font-weight: 700;
  }
  .finding-card p {
    margin: 0 0 8px; font-size: 11px; color: ${BRAND.text}; line-height: 1.6;
  }
  .finding-card ul {
    margin: 0; padding-left: 16px; list-style-type: none;
  }
  .finding-card li {
    font-size: 10.5px; margin-bottom: 4px; color: ${BRAND.text};
    padding-left: 4px; position: relative;
  }
  .finding-card li::before {
    content: '\u2192'; position: absolute; left: -14px; color: ${BRAND.orange};
    font-weight: 700;
  }

  /* ===== MANAGEMENT CARDS ===== */
  .mgmt-card {
    background: white; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 14px 18px; margin-bottom: 10px; page-break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .mgmt-card .mgmt-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  }
  .mgmt-card .mgmt-icon {
    width: 28px; height: 28px; border-radius: 6px; display: flex;
    align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
  }
  .mgmt-card h3 {
    margin: 0; font-size: 12px; font-family: 'Inter', sans-serif;
    font-weight: 700;
  }
  .mgmt-card ul {
    margin: 0; padding-left: 18px; list-style-type: disc;
  }
  .mgmt-card li {
    font-size: 10.5px; line-height: 1.7; margin-bottom: 3px; color: ${BRAND.text};
  }

  /* ===== PRINT BUTTON ===== */
  .print-btn {
    position: fixed; top: 16px; right: 16px; background: ${BRAND.navy};
    color: white; border: none; padding: 12px 28px; border-radius: 8px;
    font-size: 14px; font-weight: 600; cursor: pointer; z-index: 1000;
    font-family: 'Inter', sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    letter-spacing: 0.5px;
  }
  .print-btn:hover { background: #152d4a; }

</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">\uD83D\uDDA8 Print / Save as PDF</button>

<!-- Cover Page -->
<div class="cover">
  <div class="cover-top">
    <div class="cover-left">
      <img src="${logoBase64}" alt="Total Health" />
      <h1>Running Performance &<br/>Biomechanical Assessment</h1>
      <div class="subtitle">Performance Analysis & Rehabilitation Strategy</div>
    </div>
    <div class="cover-right">
      <div class="info-item"><div class="info-label">Patient</div><div class="info-value">${esc(patientName)}</div></div>
      ${patient?.dateOfBirth ? `<div class="info-item"><div class="info-label">Date of Birth</div><div class="info-value">${new Date(patient.dateOfBirth).toLocaleDateString('en-AU')}</div></div>` : ''}
      <div class="info-item"><div class="info-label">Assessment Date</div><div class="info-value">${assessDate}</div></div>
      ${practitionerName ? `<div class="info-item"><div class="info-label">Practitioner</div><div class="info-value">${esc(practitionerName)}</div></div>` : ''}
      ${conditionsStr ? `<div class="info-item"><div class="info-label">Testing Conditions</div><div class="info-value" style="font-size:11px;font-weight:400;line-height:1.5">${esc(conditionsStr)}</div></div>` : ''}
    </div>
  </div>
  <div class="cover-bottom">
    <span>Confidential</span>
    <span>${assessDate}</span>
  </div>
  <div class="cover-stripe"></div>
</div>

<!-- Page header is rendered by @page margin boxes (repeats on every printed page) -->

<!-- InBody Body Composition Report — directly after cover page -->
${inbodyImages.length > 0 ? `
<div class="section" style="page-break-before:always">
  <h2>InBody Body Composition Report</h2>
  ${inbodyImages.map((img: string, i: number) => `<div style="margin-bottom:12px;text-align:center${i > 0 ? ';page-break-before:always' : ''}"><img src="${img}" style="max-width:100%;max-height:230mm;width:auto;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08)" alt="InBody page ${i + 1}" /></div>`).join('')}
</div>` : ''}

<!-- VO2 Master Cardiorespiratory Report — directly after InBody -->
${vo2Images.length > 0 ? `
<div class="section" style="page-break-before:always">
  <h2>VO2 Master Cardiorespiratory Report</h2>
  ${vo2Images.map((img: string, i: number) => `<div style="margin-bottom:12px;text-align:center${i > 0 ? ';page-break-before:always' : ''}"><img src="${img}" style="max-width:100%;max-height:230mm;width:auto;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08)" alt="VO2 page ${i + 1}" /></div>`).join('')}
</div>` : ''}

<!-- How to Use This Report -->
<div class="section"${(inbodyImages.length > 0 || vo2Images.length > 0) ? ` style="page-break-before:always"` : ''}>
  <h2>How to Use This Report</h2>
  <p style="font-size:11px;line-height:1.7;color:${BRAND.text}">Running analysis evaluates how load is distributed throughout the body during movement. Every individual has a unique running pattern, and there is no absolute &ldquo;right&rdquo; or &ldquo;wrong&rdquo; way to run. The purpose of this assessment is to identify individual strengths, potential weaknesses, and areas for improvement to enhance running economy while reducing injury risk. The data and charts provided serve as objective reference points and checkpoints, allowing comparison and progress tracking following training or intervention. While textbook running mechanics provide useful guidance, there is no single gold-standard gait pattern that every runner must follow.</p>
</div>

<!-- Background -->
${displayReport?.background ? `<div class="section"><h2>Background</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${escText(displayReport.background)}</p></div>` : ''}

<!-- Running Analysis Screenshots -->
${screenshotAnnotations.length > 0 ? `<div class="section"><h2>Running Analysis</h2>${screenshotRowsHtml}</div>` : ''}

<!-- Metrics Table -->
<div style="page-break-before:always"></div>
${metricsTableHtml}

<!-- Asymmetry -->
${asymmetryHtml}

<!-- Dynamo -->
${dynamoHtml}

<!-- Impression -->
${displayReport?.impressionFromTesting ? `<div style="page-break-before:always"></div><div class="section"><h2>Impression from Testing</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${escText(displayReport.impressionFromTesting)}</p></div>` : ''}

<!-- Key Findings -->
${problemsHtml ? `<div style="page-break-before:always"></div>` : ''}
${problemsHtml}

<!-- Management -->
${mgmtSections.length > 0 ? `<div style="page-break-before:always"></div>` : ''}
${mgmtSections.length > 0 ? `
<div class="section">
  <h2>Management</h2>
  <div style="background:${BRAND.grayLight};border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:16px">
    <p style="margin:0;font-size:10.5px;line-height:1.7;color:${BRAND.gray};font-style:italic">Running cues are not a quick or universal solution. Multiple gait changes should not be introduced at the same time, as adjustments in one area often influence other aspects of movement. Focus on one cue at a time, allowing sufficient practice to adapt and understand how it affects your running. Strength and conditioning, together with structured running programming, remain the foundation of performance and injury management, with gait modification acting as a supportive adjunct. Long-term improvement is achieved through consistency, gradual progression, and appropriate training load management.</p>
  </div>
  ${(() => {
    const mgmtIcons: Record<string, { icon: string; bg: string; color: string }> = {
      'Running Cues': { icon: '\uD83C\uDFC3', bg: `${BRAND.green}15`, color: BRAND.green },
      'Gait Relearning': { icon: '\uD83E\uDDB6', bg: `${BRAND.blue}15`, color: BRAND.blue },
      'Mobility Exercises': { icon: '\uD83E\uDD38', bg: `${BRAND.orange}15`, color: BRAND.orange },
      'Strength Exercises': { icon: '\uD83C\uDFCB', bg: '#8B5CF615', color: '#8B5CF6' },
      'Running Programming': { icon: '\uD83D\uDCCB', bg: '#6366F115', color: '#6366F1' },
    };
    return mgmtSections.map(s => {
      const iconData = mgmtIcons[s.label] || { icon: '\u2022', bg: `${s.color}15`, color: s.color };
      const lines = (s.content || '').split(/\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const bulletHtml = lines.length > 1
        ? `<ul class="mgmt-card">${lines.map((l: string) => {
            const cleaned = l.replace(/^[-*\u2022]\s*/, '').replace(/^\d+\.\s*/, '');
            return `<li>${esc(cleaned)}</li>`;
          }).join('')}</ul>`
        : `<p style="margin:4px 0 0;font-size:10.5px;line-height:1.7;color:${BRAND.text}">${esc(lines[0] || '')}</p>`;
      return `
      <div class="mgmt-card">
        <div class="mgmt-header">
          <div class="mgmt-icon" style="background:${iconData.bg};color:${iconData.color}">${iconData.icon}</div>
          <h3 style="color:${iconData.color}">${s.label}</h3>
        </div>
        ${bulletHtml}
      </div>`;
    }).join('');
  })()}
</div>` : ''}

<!-- Summary -->
${displayReport?.summary ? `<div class="section"><h2>Summary</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${escText(displayReport.summary)}</p></div>` : ''}

<!-- Follow-up Reassessment -->
${formData?.followUpMonths && formData?.assessmentDate ? (() => {
  const d = new Date(formData.assessmentDate);
  d.setMonth(d.getMonth() + formData.followUpMonths);
  const reassessDate = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="section">
    <h2>Follow-up Action</h2>
    <div style="background:${BRAND.grayLight};border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px">
      <p style="margin:0;font-size:12px;color:${BRAND.text};font-family:Inter,sans-serif"><strong style="color:${BRAND.navy}">Reassessment recommended:</strong> ${reassessDate} <span style="color:${BRAND.gray}">(${formData.followUpMonths} month${formData.followUpMonths > 1 ? 's' : ''} from assessment date)</span></p>
    </div>
  </div>`;
})() : ''}

<!-- Practitioner Sign-off -->
${reportPractitioner ? `<div style="margin-top:48px;padding-top:28px;border-top:3px solid ${BRAND.navy}">
  <p style="font-size:11px;color:${BRAND.gray};margin-bottom:20px;font-family:Inter,sans-serif">Kind regards,</p>
  <p style="font-size:18px;font-weight:800;color:${BRAND.navy};margin:0;font-family:Inter,sans-serif">${esc(reportPractitioner.name)}</p>
  ${reportPractitioner.title ? `<p style="font-size:12px;color:${BRAND.blue};margin:4px 0 0;font-family:Inter,sans-serif;font-weight:500">${esc(reportPractitioner.title)}${reportPractitioner.qualifications ? `, ${esc(reportPractitioner.qualifications)}` : ''}</p>` : ''}
  ${reportPractitioner.clinic ? `<p style="font-size:11px;color:${BRAND.text};margin:12px 0 0;font-weight:600">${esc(reportPractitioner.clinic)}</p>` : ''}
  <div style="margin-top:12px;font-size:10px;color:${BRAND.gray};line-height:2.0">
    ${reportPractitioner.phone ? `<p style="margin:0">Phone: ${esc(reportPractitioner.phone)}</p>` : ''}
    ${reportPractitioner.email ? `<p style="margin:0">Email: ${esc(reportPractitioner.email)}</p>` : ''}
    ${reportPractitioner.website ? `<p style="margin:0">Web: ${esc(reportPractitioner.website)}</p>` : ''}
    ${reportPractitioner.address ? `<p style="margin:0">Address: ${esc(reportPractitioner.address)}</p>` : ''}
  </div>
</div>` : ''}

<!-- Page Footer -->
<div style="margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-family:Inter,sans-serif;font-size:8px;color:${BRAND.gray};text-transform:uppercase;letter-spacing:1px">
  <span>${esc(patientName)}</span>
  <span>Confidential</span>
</div>

</body></html>`;

      toast.dismiss("pdf-prep");

      // Replace the placeholder with the finished report
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      toast.success("Report opened in new tab. In the print dialog, uncheck 'Headers and footers' for a clean PDF.", { duration: 8000 });
      setExporting(false);
    } catch (err: any) {
      console.error("PDF export error:", err);
      printWindow.close();
      toast.dismiss("pdf-prep");
      toast.error(err.message || "Failed to export PDF");
      setExporting(false);
    }
  };

  // ======================== IN-APP PREVIEW ========================
  // (moved marker up after removing legacy code)
  if (!report) {
    return (
      <Card className="border-dashed border-[#1A6B9C]/20">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-14 w-14 rounded-2xl bg-[#1A6B9C]/10 flex items-center justify-center mb-4">
            <Wand2 className="h-7 w-7 text-[#1A6B9C]" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No report generated yet</h3>
          <p className="text-sm text-muted-foreground mb-5 text-center max-w-md">
            Fill in the assessment data across all tabs, add your clinical notes, then generate an AI-assisted professional report.
          </p>
          <Button
            onClick={() => generateReport.mutate({ assessmentId })}
            disabled={generateReport.isPending}
            className="bg-[#1A6B9C] hover:bg-[#0F4C6E]"
          >
            {generateReport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Badge variant="outline" className="bg-[#E8862A]/10 text-[#E8862A] border-[#E8862A]/30">
                <Pencil className="h-3 w-3 mr-1" /> Editing
              </Badge>
              <p className="text-xs text-muted-foreground">Edit any section below, then save your changes.</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Review the generated report. Click Edit to modify any section.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
              <Button size="sm" onClick={saveEdits} disabled={saving} className="bg-[#1A6B9C] hover:bg-[#0F4C6E]">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Edit Report
              </Button>
              <Button variant="outline" size="sm" onClick={() => generateReport.mutate({ assessmentId })} disabled={generateReport.isPending}>
                {generateReport.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Regenerate
              </Button>
              <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="bg-[#1A6B9C] hover:bg-[#0F4C6E]">
                {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
                Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={reportRef} className="space-y-4">
        {/* Background */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1A2744]">Background</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={asText(editingReport?.background)}
                onChange={e => updateField("background", e.target.value)}
                rows={6}
                className="text-sm"
                placeholder="Runner background, training history, injury history..."
              />
            ) : (
              displayReport?.background ? <PlainText>{displayReport.background}</PlainText> : <p className="text-sm text-muted-foreground italic">No background content.</p>
            )}
          </CardContent>
        </Card>

        {/* InBody Body Composition Report — included when uploaded */}
        {formData?.inbodyFileUrl && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1A2744]">InBody Body Composition Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-xs text-muted-foreground py-4">Loading PDF viewer…</div>}>
                <PdfPageRenderer url={formData.inbodyFileUrl} maxPages={5} />
              </Suspense>
              {formData.inbodyNotes && (
                <div className="mt-3 text-sm">
                  <p className="font-medium mb-1">Notes</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{formData.inbodyNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* VO2 Master Cardiorespiratory Report — included when uploaded */}
        {formData?.vo2FileUrl && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1A2744]">VO2 Master Cardiorespiratory Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="text-xs text-muted-foreground py-4">Loading PDF viewer…</div>}>
                <PdfPageRenderer url={formData.vo2FileUrl} maxPages={5} />
              </Suspense>
              {formData.vo2Notes && (
                <div className="mt-3 text-sm">
                  <p className="font-medium mb-1">Notes</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{formData.vo2Notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Screenshots with annotations — grouped by gait phase,
            Left side on the left column, Right side on the right column */}
        {screenshotsList && screenshotsList.length > 0 && (() => {
          const phaseOrder = ["foot_strike", "loading", "mid_stance", "push_off", "swing"];
          const phaseLabels: Record<string, string> = {
            foot_strike: "Foot Strike",
            loading: "Loading",
            mid_stance: "Loading",
            push_off: "Push Off",
            swing: "Swing",
          };
          const viewSort: Record<string, number> = { side_left: 0, side_right: 1, back: 2 };
          const groups = new Map<string, typeof screenshotsList>();
          for (const ss of screenshotsList) {
            const key = ss.gaitPhase || "other";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(ss);
          }
          const orderedKeys = [
            ...phaseOrder.filter(k => groups.has(k)),
            ...Array.from(groups.keys()).filter(k => !phaseOrder.includes(k)),
          ];
          return (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base text-[#1A2744]">Running Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {orderedKeys.map(key => {
                  const group = [...groups.get(key)!].sort(
                    (a, b) => (viewSort[a.viewType] ?? 3) - (viewSort[b.viewType] ?? 3)
                  );
                  return (
                    <div key={key} className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {phaseLabels[key] || key}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {group.map(ss => (
                          <AnnotatedScreenshot key={ss.id} screenshot={ss} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}

        {/* 10-Metric Running Assessment Table */}
        {displayReport?.metricsRatings && displayReport.metricsRatings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1A2744]">10-Metric Running Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#1A2744] text-white">
                      <th className="text-left p-2 font-semibold text-xs uppercase tracking-wide w-10">ID</th>
                      <th className="text-left p-2 font-semibold text-xs uppercase tracking-wide">Metric</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-14">View</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-20">Phase</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-14">Left</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-14">Right</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-16">Avg</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-20">Ref. Target</th>
                      <th className="text-center p-2 font-semibold text-xs uppercase tracking-wide w-20">Rating</th>
                      <th className="text-left p-2 font-semibold text-xs uppercase tracking-wide">Load Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayReport.metricsRatings.map((r: MetricRating, i: number) => {
                      const isCategory = r.unit === 'category';
                      const hasLR = r.leftValue != null || r.rightValue != null;
                      return (
                      <tr key={i} className="border-b last:border-0 even:bg-muted/30">
                        <td className="p-2 font-mono font-semibold text-[#0F4C6E] text-xs">{r.metricId || ''}</td>
                        <td className="p-2 font-medium text-xs">{r.metricName}</td>
                        <td className="p-2 text-center text-xs text-muted-foreground">{r.view || ''}</td>
                        <td className="p-2 text-center text-xs text-muted-foreground">{r.phase || ''}</td>
                        <td className="p-2 text-center font-mono text-xs text-[#1A6B9C]">
                          {hasLR && r.leftValue != null ? `${r.leftValue}\u00b0` : '\u2014'}
                        </td>
                        <td className="p-2 text-center font-mono text-xs text-[#E8862A]">
                          {hasLR && r.rightValue != null ? `${r.rightValue}\u00b0` : '\u2014'}
                        </td>
                        <td className="p-2 text-center font-mono text-xs">
                          {r.rating === 'Not Measured' ? (
                            <span className="text-muted-foreground italic">\u2014</span>
                          ) : isCategory ? (
                            <span className="text-amber-700 text-[10px]">{r.rating}</span>
                          ) : (
                            <span>{r.measuredValue}\u00b0</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono text-xs text-muted-foreground">{r.optimalRange || ''}</td>
                        <td className="p-2 text-center">
                          <Badge className={`text-xs ${
                            (r.rating === 'Optimal' || r.rating === 'Ref. Target') ? 'bg-[#7A9A3B]/15 text-[#7A9A3B] hover:bg-[#7A9A3B]/15' :
                            r.rating === 'Low' ? 'bg-[#1A6B9C]/15 text-[#1A6B9C] hover:bg-[#1A6B9C]/15' :
                            r.rating === 'High' ? 'bg-[#E8862A]/15 text-[#E8862A] hover:bg-[#E8862A]/15' :
                            'bg-gray-100 text-gray-500 hover:bg-gray-100'
                          }`}>
                            {r.rating === 'Optimal' ? 'Ref. Target' : r.rating}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {isCategory && r.finding ? r.finding : (r.loadShift && r.loadShift !== '\u2014' ? r.loadShift : '\u2014')}
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                {isEditing ? (
                  <Textarea
                    value={asText(editingReport?.metricsAnalysis)}
                    onChange={e => updateField("metricsAnalysis", e.target.value)}
                    rows={4}
                    className="text-sm"
                    placeholder="One bullet point per line \u2014 patterns, priorities, key deviations"
                  />
                ) : <BulletList value={displayReport?.metricsAnalysis} />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Left/Right Asymmetry \u2014 chart only (table removed per design decision) */}
        {displayReport?.asymmetryData && displayReport.asymmetryData.length > 0 &&
          displayReport.asymmetryData.some((a: AsymmetryItem) => a.leftValue !== null && a.rightValue !== null) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#1A2744]">Left vs Right Asymmetry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-3 bg-white overflow-x-auto" dangerouslySetInnerHTML={{ __html: generateAsymmetryChartSVG(displayReport.asymmetryData) }} />
              <div className="mt-3">
                {isEditing ? (
                  <Textarea
                    value={asText(editingReport?.asymmetryAnalysis)}
                    onChange={e => updateField("asymmetryAnalysis", e.target.value)}
                    rows={4}
                    className="text-sm"
                    placeholder="One bullet point per line \u2014 side bias, clinical implications"
                  />
                ) : <BulletList value={displayReport?.asymmetryAnalysis} />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VALD Dynamo Strength Results */}
        {((displayReport?.dynamoTests && displayReport.dynamoTests.length > 0) || (dynamoTestsList && dynamoTestsList.length > 0)) && (() => {
          const dynamoData = displayReport?.dynamoTests || dynamoTestsList || [];
          const grouped: Record<string, typeof dynamoData> = {};
          for (const t of dynamoData) {
            if (!grouped[t.joint]) grouped[t.joint] = [];
            grouped[t.joint]!.push(t);
          }
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[#1A2744]">Strength Assessment (VALD Dynamo)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(grouped).map(([joint, tests]) => (
                    <div key={joint}>
                      <h4 className="text-sm font-semibold mb-1 text-[#1A6B9C]">{joint}</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#1A2744] text-white">
                              <th className="text-left p-2 font-medium text-xs uppercase tracking-wide">Movement</th>
                              <th className="text-left p-2 font-medium text-xs uppercase tracking-wide">Measure</th>
                              <th className="text-center p-2 font-medium text-xs uppercase tracking-wide">Left</th>
                              <th className="text-center p-2 font-medium text-xs uppercase tracking-wide">Right</th>
                              <th className="text-center p-2 font-medium text-xs uppercase tracking-wide">Unit</th>
                              <th className="text-center p-2 font-medium text-xs uppercase tracking-wide">Asymmetry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tests.map((t: any, i: number) => {
                              const calcAsym = (l: number | null, r: number | null) => {
                                if (l == null || r == null || (l === 0 && r === 0)) return null;
                                const max = Math.max(l, r), min = Math.min(l, r);
                                return max > 0 ? Math.round(((max - min) / max) * 100) : null;
                              };
                              const pfAsym = calcAsym(t.leftPeakForce, t.rightPeakForce);
                              const rfdAsym = calcAsym(t.leftPeakRfd, t.rightPeakRfd);
                              const ttpAsym = calcAsym(t.leftTimeToPeak, t.rightTimeToPeak);
                              const asymBadge = (v: number | null) => v != null ? (
                                <Badge variant="outline" className={`text-[10px] ${
                                  v <= 10 ? "bg-[#7A9A3B]/10 text-[#7A9A3B] border-[#7A9A3B]/30" :
                                  v <= 15 ? "bg-[#E8862A]/10 text-[#E8862A] border-[#E8862A]/30" :
                                  v <= 25 ? "bg-orange-50 text-orange-700 border-orange-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{v}%</Badge>
                              ) : "\u2014";
                              const rows = [
                                { label: "Mean Force", l: t.leftValue, r: t.rightValue, unit: t.unit, asym: t.asymmetryPercent },
                                { label: "Peak Force", l: t.leftPeakForce, r: t.rightPeakForce, unit: t.peakForceUnit || "N", asym: pfAsym },
                                { label: "Peak RFD", l: t.leftPeakRfd, r: t.rightPeakRfd, unit: t.peakRfdUnit || "N/s", asym: rfdAsym },
                                { label: "Time to Peak", l: t.leftTimeToPeak, r: t.rightTimeToPeak, unit: "ms", asym: ttpAsym },
                              ].filter(row => row.l != null || row.r != null);
                              return rows.map((row, ri) => (
                                <tr key={`${i}-${ri}`} className={`border-b last:border-0 ${ri === 0 ? "bg-muted/30" : ""}`}>
                                  {ri === 0 && (
                                    <td rowSpan={rows.length} className="p-2 font-semibold align-top text-xs">
                                      {t.movement}
                                      {t.position && <span className="block text-[10px] font-normal text-muted-foreground">({t.position})</span>}
                                    </td>
                                  )}
                                  <td className="p-2 text-muted-foreground text-xs">{row.label}</td>
                                  <td className="p-2 text-center font-mono text-xs">{row.l != null ? row.l : "\u2014"}</td>
                                  <td className="p-2 text-center font-mono text-xs">{row.r != null ? row.r : "\u2014"}</td>
                                  <td className="p-2 text-center text-muted-foreground text-xs">{row.unit}</td>
                                  <td className="p-2 text-center">{asymBadge(row.asym)}</td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Impression from Testing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1A2744]">Impression from Testing</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={asText(editingReport?.impressionFromTesting)}
                onChange={e => updateField("impressionFromTesting", e.target.value)}
                rows={6}
                className="text-sm"
                placeholder="Clinical impression from testing..."
              />
            ) : (
              displayReport?.impressionFromTesting ? <PlainText>{displayReport.impressionFromTesting}</PlainText> : <p className="text-sm text-muted-foreground italic">No impression content.</p>
            )}
          </CardContent>
        </Card>

        {/* Key Findings / Problems */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-[#1A2744]">Key Findings</CardTitle>
              {isEditing && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addProblem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Finding
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              editingReport?.problems && editingReport.problems.length > 0 ? (
                editingReport.problems.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                    <div className="flex items-center gap-2">
                      <Input
                        value={asText(p.title)}
                        onChange={e => updateField(`problems.${i}.title`, e.target.value)}
                        className="text-sm font-medium h-8"
                        placeholder="Finding title..."
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" onClick={() => removeProblem(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove finding</TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      value={asText(p.description)}
                      onChange={e => updateField(`problems.${i}.description`, e.target.value)}
                      rows={2}
                      className="text-sm"
                      placeholder="Description..."
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium">Bullet points</p>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => addFinding(i)}>
                          <Plus className="h-3 w-3 mr-0.5" /> Add
                        </Button>
                      </div>
                      {p.findings?.map((f, j) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <span className="text-[#E8862A] text-xs">\u25B8</span>
                          <Input
                            value={asText(f)}
                            onChange={e => updateField(`problems.${i}.findings.${j}`, e.target.value)}
                            className="text-sm h-7 flex-1"
                            placeholder="Finding detail..."
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeFinding(i, j)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No findings. Click "Add Finding" to add one.</p>
              )
            ) : (
              displayReport?.problems && displayReport.problems.length > 0 ? (
                displayReport.problems.map((p: any, i: number) => (
                  <div key={i} className="border-l-4 border-[#1A6B9C] bg-[#1A6B9C]/5 pl-4 pr-3 py-3 rounded-r-lg">
                    <h4 className="font-semibold text-[#1A2744]">{asText(p.title)}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{asText(p.description)}</p>
                    {p.findings && p.findings.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.findings.map((f: unknown, j: number) => (
                          <li key={j} className="text-sm flex items-start gap-2">
                            <span className="text-[#E8862A] mt-0.5">\u25B8</span>
                            <span>{asText(f)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No key findings.</p>
              )
            )}
          </CardContent>
        </Card>

        {/* Management */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1A2744]">Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              // Combine legacy runningCues into gaitRelearning for display/edit
              const combinedGait = [asText(displayReport?.management?.runningCues), asText(displayReport?.management?.gaitRelearning)].filter(Boolean).join('\n');
              const combinedEditGait = [asText(editingReport?.management?.runningCues), asText(editingReport?.management?.gaitRelearning)].filter(Boolean).join('\n');
              const hasAny = combinedGait || displayReport?.management?.mobilityExercises || displayReport?.management?.strengthExercises || displayReport?.management?.runningProgramming;
              return isEditing ? (
                <>
                  <EditableManagementSection label="Gait Relearning" value={combinedEditGait} onChange={v => { updateField("management.gaitRelearning", v); updateField("management.runningCues", ""); }} color="blue" />
                  <EditableManagementSection label="Mobility Exercises" value={asText(editingReport?.management?.mobilityExercises)} onChange={v => updateField("management.mobilityExercises", v)} color="amber" />
                  <EditableManagementSection label="Strength Exercises" value={asText(editingReport?.management?.strengthExercises)} onChange={v => updateField("management.strengthExercises", v)} color="purple" />
                  <EditableManagementSection label="Running Programming" value={asText(editingReport?.management?.runningProgramming)} onChange={v => updateField("management.runningProgramming", v)} color="indigo" />
                </>
              ) : (
                <>
                  {combinedGait && <ManagementSection label="Gait Relearning" content={combinedGait} color="blue" />}
                  {displayReport?.management?.mobilityExercises && <ManagementSection label="Mobility Exercises" content={displayReport.management.mobilityExercises} color="amber" />}
                  {displayReport?.management?.strengthExercises && <ManagementSection label="Strength Exercises" content={displayReport.management.strengthExercises} color="purple" />}
                  {displayReport?.management?.runningProgramming && <ManagementSection label="Running Programming" content={displayReport.management.runningProgramming} color="indigo" />}
                  {!hasAny && (
                    <p className="text-sm text-muted-foreground italic">No management recommendations.</p>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#1A2744]">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={asText(editingReport?.summary)}
                onChange={e => updateField("summary", e.target.value)}
                rows={4}
                className="text-sm"
                placeholder="Overall summary and recommendations..."
              />
            ) : (
              displayReport?.summary ? <PlainText>{displayReport.summary}</PlainText> : <p className="text-sm text-muted-foreground italic">No summary content.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom save bar when editing */}
      {isEditing && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-3 flex items-center justify-end gap-2 -mx-1 rounded-lg">
          <Button variant="outline" size="sm" onClick={cancelEditing}>Discard Changes</Button>
          <Button size="sm" onClick={saveEdits} disabled={saving} className="bg-[#1A6B9C] hover:bg-[#0F4C6E]">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save All Changes
          </Button>
        </div>
      )}
    </div>
  );
}

// Sub-components for management sections
const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  green: { bg: "bg-[#7A9A3B]/10", border: "border-[#7A9A3B]", text: "text-[#4a6023]" },
  blue: { bg: "bg-[#1A6B9C]/10", border: "border-[#1A6B9C]", text: "text-[#0F4C6E]" },
  amber: { bg: "bg-[#E8862A]/10", border: "border-[#E8862A]", text: "text-[#92610b]" },
  purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-800" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-500", text: "text-indigo-800" },
};

function ManagementSection({ label, content, color }: { label: string; content: unknown; color: string }) {
  const c = colorMap[color] || colorMap.green;
  return (
    <div className={`${c.bg} border-l-4 ${c.border} pl-4 py-2.5 rounded-r-lg`}>
      <h4 className={`font-semibold ${c.text} text-sm`}>{label}</h4>
      <PlainText>{asText(content)}</PlainText>
    </div>
  );
}

function EditableManagementSection({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: string }) {
  const c = colorMap[color] || colorMap.green;
  return (
    <div className={`${c.bg} border-l-4 ${c.border} pl-4 py-2.5 pr-3 rounded-r-lg`}>
      <h4 className={`font-semibold ${c.text} text-sm mb-1.5`}>{label}</h4>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="text-sm bg-white/80"
        placeholder={`${label} recommendations...`}
      />
    </div>
  );
}
