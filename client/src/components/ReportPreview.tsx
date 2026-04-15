import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, FileDown, Wand2, RefreshCw, Pencil, Eye, Save, Plus, Trash2 } from "lucide-react";
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
// PdfPageRenderer removed — VO2/InBody not shown in report preview
import { toast } from "sonner";
import { renderPdfToBase64Images } from "@/components/PdfPageRenderer";
// Plain text renderer - replaces Streamdown to prevent markdown/code rendering
function PlainText({ children }: { children: string }) {
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{children}</p>;
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
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.roundRect(vx - tw/2 - 4, vy - fontSize - 6, tw + 8, fontSize + 6, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, vx, vy - 3);
      ctx.textBaseline = "alphabetic";
    } else if ((annType === "line" || annType === "horizontal" || annType === "vertical") && pts.length >= 2) {
      ctx.beginPath();
      if (annType === "horizontal") { ctx.moveTo(0, pts[0].y * h); ctx.lineTo(w, pts[0].y * h); }
      else if (annType === "vertical") { ctx.moveTo(pts[0].x * w, 0); ctx.lineTo(pts[0].x * w, h); }
      else { ctx.moveTo(pts[0].x * w, pts[0].y * h); ctx.lineTo(pts[1].x * w, pts[1].y * h); }
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

  const width = 560;
  const rowH = 44;
  const labelW = 100;
  const barAreaW = (width - labelW - 20) / 2;
  const centerX = labelW + barAreaW;
  const height = items.length * rowH + 60;
  const maxVal = Math.max(...items.flatMap(a => [Math.abs(a.leftValue || 0), Math.abs(a.rightValue || 0)])) * 1.2 || 30;

  let bars = '';
  bars += `<text x="${centerX - barAreaW / 2}" y="16" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.blue}" font-weight="700">LEFT</text>`;
  bars += `<text x="${centerX + barAreaW / 2}" y="16" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" fill="${BRAND.orange}" font-weight="700">RIGHT</text>`;
  bars += `<line x1="${centerX}" y1="24" x2="${centerX}" y2="${height - 30}" stroke="#e2e8f0" stroke-width="1.5" />`;

  items.forEach((a, i) => {
    const y = i * rowH + 30;
    const leftW = ((a.leftValue || 0) / maxVal) * barAreaW;
    const rightW = ((a.rightValue || 0) / maxVal) * barAreaW;
    if (i % 2 === 0) bars += `<rect x="0" y="${y}" width="${width}" height="${rowH}" fill="${BRAND.grayLight}" rx="0" />`;
    bars += `<rect x="${centerX - leftW}" y="${y + 6}" width="${leftW}" height="${rowH - 18}" rx="3" fill="${BRAND.blue}" opacity="0.8" />`;
    bars += `<text x="${centerX - leftW - 4}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="middle" font-size="9" font-family="Inter, monospace" fill="${BRAND.blue}" font-weight="600">${a.leftValue}\u00b0</text>`;
    bars += `<rect x="${centerX}" y="${y + 6}" width="${rightW}" height="${rowH - 18}" rx="3" fill="${BRAND.orange}" opacity="0.8" />`;
    bars += `<text x="${centerX + rightW + 4}" y="${y + rowH / 2}" dominant-baseline="middle" font-size="9" font-family="Inter, monospace" fill="${BRAND.orange}" font-weight="600">${a.rightValue}\u00b0</text>`;
    bars += `<text x="4" y="${y + rowH / 2 - 4}" dominant-baseline="middle" font-size="8.5" font-family="Inter, sans-serif" fill="${BRAND.navy}" font-weight="600">${a.metricName.length > 16 ? a.metricName.substring(0, 15) + '\u2026' : a.metricName}</text>`;
    if (a.difference !== null) {
      const absDiff = Math.abs(a.difference);
      const diffColor = absDiff <= 2 ? BRAND.green : absDiff <= 5 ? BRAND.orange : '#dc2626';
      bars += `<text x="4" y="${y + rowH / 2 + 8}" font-size="7.5" font-family="Inter, sans-serif" fill="${diffColor}" font-weight="600">\u0394 ${absDiff}\u00b0 ${absDiff <= 2 ? '\u2713' : '\u26A0'}</text>`;
    }
  });

  const legendY = height - 8;
  const legend = `<text x="${width / 2}" y="${legendY}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">
    <tspan fill="${BRAND.blue}">\u25A0</tspan> Left \u00a0\u00a0 <tspan fill="${BRAND.orange}">\u25A0</tspan> Right \u00a0\u00a0 <tspan fill="${BRAND.green}">\u2713</tspan> Symmetric \u00a0 <tspan fill="#dc2626">\u26A0</tspan> Asymmetric
  </text>`;

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${bars}
    ${legend}
  </svg>`;
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
        // Use the STORED angle value — plain bold text, no box
        const displayVal = ann.measuredValue != null ? Math.round(ann.measuredValue * 10) / 10 : null;
        if (displayVal != null) {
          const label = `${displayVal}\u00B0`;
          const vx = pts[1].x * 100;
          const vy = pts[1].y * 100;
          // Simple offset: 10 units to the left and 10 units above the vertex
          let lx = vx - 10;
          let ly = vy - 10;
          // Clamp within bounds
          lx = Math.max(5, Math.min(95, lx));
          ly = Math.max(5, Math.min(95, ly));
          // Bold text, no outline, no box — just the angle value
          svgContent += `<text x="${lx}%" y="${ly}%" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="20%" font-weight="900" font-family="Arial, sans-serif">${label}</text>`;
        }
      } else if ((annType === 'line' || annType === 'horizontal' || annType === 'vertical') && pts.length >= 2) {
        if (annType === 'horizontal') {
          svgContent += `<line x1="0" y1="${pts[0].y*100}%" x2="100%" y2="${pts[0].y*100}%" stroke="${color}" stroke-width="${sw}%" />`;
        } else if (annType === 'vertical') {
          svgContent += `<line x1="${pts[0].x*100}%" y1="0" x2="${pts[0].x*100}%" y2="100%" stroke="${color}" stroke-width="${sw}%" />`;
        } else {
          svgContent += `<line x1="${pts[0].x*100}%" y1="${pts[0].y*100}%" x2="${pts[1].x*100}%" y2="${pts[1].y*100}%" stroke="${color}" stroke-width="${sw}%" />`;
        }
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
    try {
      toast.info("Preparing report for print... Rendering screenshots.", { duration: 60000, id: "pdf-prep" });

      // Fetch annotations for all screenshots and convert images to base64
      const screenshotAnnotations: { screenshot: any; annotations: any[]; base64: string }[] = [];
      if (screenshotsList && screenshotsList.length > 0) {
        for (const ss of screenshotsList) {
          try {
            const anns = await utils.annotation.list.fetch({ screenshotId: ss.id });
            // Convert image to base64 (raw image — annotations will be SVG overlay)
            const base64 = await imageToBase64(ss.imageUrl);
            screenshotAnnotations.push({ screenshot: ss, annotations: anns || [], base64 });
          } catch {
            const base64 = await imageToBase64(ss.imageUrl);
            screenshotAnnotations.push({ screenshot: ss, annotations: [], base64 });
          }
        }
      }

      // Convert logo to base64
      const logoBase64 = await imageToBase64(LOGO_HORIZONTAL);

      // Render InBody and VO2 PDF pages to images
      let inbodyImages: string[] = [];
      let vo2Images: string[] = [];
      if (formData?.inbodyFileUrl) {
        try {
          inbodyImages = await renderPdfToBase64Images(formData.inbodyFileUrl, 2, 5);
        } catch {
          console.error("Failed to render InBody PDF pages");
        }
      }
      if (formData?.vo2FileUrl) {
        try {
          vo2Images = await renderPdfToBase64Images(formData.vo2FileUrl, 2, 5);
        } catch {
          console.error("Failed to render VO2 PDF pages");
        }
      }

      // Build the asymmetry chart SVG
      const asymSvg = displayReport?.asymmetryData ? generateAsymmetryChartSVG(displayReport.asymmetryData) : '';

      // Build the full HTML report
      const patientName = patient ? patient.name : 'Unknown';
      const practitionerName = reportPractitioner?.name || '';
      const today = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
      const assessDate = formData?.assessmentDate ? new Date(formData.assessmentDate).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }) : today;

      // Helper to build screenshot grid HTML with SVG annotation overlays
      const screenshotGridHtml = screenshotAnnotations.map(({ screenshot: ss, annotations: anns, base64 }) => {
        const view = ss.viewType === 'side_left' ? 'Left Side' : ss.viewType === 'side_right' ? 'Right Side' : ss.viewType === 'back' ? 'Back View' : ss.viewType;
        const phase = ss.gaitPhase === 'foot_strike' ? 'Foot Strike' : ss.gaitPhase === 'loading' || ss.gaitPhase === 'mid_stance' ? 'Loading' : ss.gaitPhase === 'push_off' ? 'Push Off' : ss.gaitPhase === 'swing' ? 'Swing' : ss.gaitPhase;
        const svgOverlay = anns.length > 0 ? `<svg class="ss-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">${generateAnnotationSVG(anns)}</svg>` : '';
        return `<div class="ss-card">
          <div class="ss-img-wrap">
            <img src="${base64}" alt="${view} - ${phase}" />
            ${svgOverlay}
          </div>
          <div class="ss-label">${view} \u2014 ${phase}${ss.description ? ': ' + ss.description : ''}</div>
        </div>`;
      }).join('');

      // Group screenshots by gait phase, pairing L and R side-by-side
      const screenshotRowsHtml = (() => {
        // Build card data with metadata
        const cardData = screenshotAnnotations.map(({ screenshot: ss, annotations: anns, base64 }) => {
          const view = ss.viewType === 'side_left' ? 'Left Side' : ss.viewType === 'side_right' ? 'Right Side' : ss.viewType === 'back' ? 'Back View' : ss.viewType;
          const phase = ss.gaitPhase === 'foot_strike' ? 'Foot Strike' : ss.gaitPhase === 'loading' || ss.gaitPhase === 'mid_stance' ? 'Loading' : ss.gaitPhase === 'push_off' ? 'Push Off' : ss.gaitPhase === 'swing' ? 'Swing' : ss.gaitPhase;
          const svgOverlay = anns.length > 0 ? `<svg class="ss-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">${generateAnnotationSVG(anns)}</svg>` : '';
          const html = `<div class="ss-card">
            <div class="ss-img-wrap">
              <img src="${base64}" alt="${view} - ${phase}" />
              ${svgOverlay}
            </div>
            <div class="ss-label">${view} \u2014 ${phase}${ss.description ? ': ' + ss.description : ''}</div>
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
              rows += `<div class="ss-phase-title">${phaseTitle}</div><div class="ss-row">${pair}</div>`;
            }
          }
        }
        // Any remaining phases not in the standard order
        Array.from(phaseGroups.entries()).forEach(([phaseKey, group]) => {
          if (processedPhases.has(phaseKey)) return;
          for (let i = 0; i < group.length; i += 2) {
            const pair = group.slice(i, i + 2).map((c: { html: string }) => c.html).join('');
            const phaseTitle = group[0].phase;
            rows += `<div class="ss-phase-title">${phaseTitle}</div><div class="ss-row">${pair}</div>`;
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
              ${displayReport.metricsRatings.map((r: MetricRating, i: number) => {
                const isCategory = r.unit === 'category';
                const hasLR = r.leftValue != null || r.rightValue != null;
                const ratingClass = (r.rating === 'Optimal' || r.rating === 'Ref. Target') ? 'rating-optimal' : r.rating === 'Low' ? 'rating-low' : r.rating === 'High' ? 'rating-high' : 'rating-na';
                return `<tr class="${i % 2 === 0 ? 'even' : ''}">
                  <td class="mono" style="color:${BRAND.navy};font-weight:700;font-size:10px">${r.metricId || ''}</td>
                  <td style="font-weight:600;font-family:Inter,sans-serif;font-size:10px">${r.metricName}</td>
                  <td class="center muted" style="font-size:9px">${r.view || ''}</td>
                  <td class="center muted" style="font-size:9px">${r.phase || ''}</td>
                  <td class="center mono" style="color:${BRAND.blue};font-weight:600">${hasLR && r.leftValue != null ? r.leftValue + '\u00b0' : '\u2014'}</td>
                  <td class="center mono" style="color:${BRAND.orange};font-weight:600">${hasLR && r.rightValue != null ? r.rightValue + '\u00b0' : '\u2014'}</td>
                  <td class="center mono" style="font-weight:600">${r.rating === 'Not Measured' ? '\u2014' : isCategory ? r.rating : r.measuredValue + '\u00b0'}</td>
                  <td class="center mono muted" style="font-size:9px">${r.optimalRange || ''}</td>
                  <td class="center"><span class="${ratingClass}">${r.rating === 'Optimal' ? 'Ref. Target' : r.rating}</span></td>
                  <td style="color:${BRAND.text};font-size:9.5px">${isCategory && r.finding ? r.finding : (r.loadShift && r.loadShift !== '\u2014' ? r.loadShift : '\u2014')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : '';

      // Asymmetry table HTML
      const asymmetryHtml = displayReport?.asymmetryData && displayReport.asymmetryData.length > 0 ? (() => {
        const sideItems = displayReport.asymmetryData.filter((a: AsymmetryItem) => a.view === 'Side' || (!a.view && !['Pelvic Drop','Step Width','Knee Frontal Plane Angle','Rearfoot Eversion','Trunk Rotation Asym','Hip Rotation (Mid-Swing)','Push-Off Alignment'].includes(a.metricName)));
        const backItems = displayReport.asymmetryData.filter((a: AsymmetryItem) => a.view === 'Back' || (!a.view && ['Pelvic Drop','Step Width','Knee Frontal Plane Angle','Rearfoot Eversion','Trunk Rotation Asym','Hip Rotation (Mid-Swing)','Push-Off Alignment'].includes(a.metricName)));
        const renderTable = (items: AsymmetryItem[], title: string) => items.length === 0 ? '' : `
          <h3 style="font-family:Inter,sans-serif;font-size:10px;color:${BRAND.gray};text-transform:uppercase;letter-spacing:1.5px;margin:16px 0 8px;font-weight:600">${title}</h3>
          <table>
            <thead><tr><th>Metric</th><th style="width:70px">Left</th><th style="width:70px">Right</th><th style="width:60px">Diff</th><th style="width:90px">Symmetry</th></tr></thead>
            <tbody>${items.map((a: AsymmetryItem, i: number) => {
              const absDiff = a.difference !== null ? Math.abs(a.difference) : null;
              const symLabel = absDiff !== null ? (absDiff <= 2 ? '\u2713 Symmetric' : absDiff <= 5 ? '\u26A0 Minor' : '\u26A0 Notable') : '\u2014';
              const symColor = absDiff !== null ? (absDiff <= 2 ? BRAND.green : absDiff <= 5 ? BRAND.orange : '#dc2626') : BRAND.gray;
              return `<tr class="${i % 2 === 0 ? 'even' : ''}">
                <td style="font-weight:600;font-family:Inter,sans-serif">${a.metricName}</td>
                <td class="center mono" style="color:${BRAND.blue};font-size:13px;font-weight:700">${a.leftValue !== null ? a.leftValue + '\u00b0' : '\u2014'}</td>
                <td class="center mono" style="color:${BRAND.orange};font-size:13px;font-weight:700">${a.rightValue !== null ? a.rightValue + '\u00b0' : '\u2014'}</td>
                <td class="center mono" style="font-size:11px;font-weight:600">${absDiff !== null ? absDiff + '\u00b0' : '\u2014'}</td>
                <td class="center" style="color:${symColor};font-weight:700;font-size:9px;font-family:Inter,sans-serif">${symLabel}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`;
        return `<div class="section">
          <h2>Left vs Right Asymmetry</h2>
          ${renderTable(sideItems, 'Side View Metrics (M01\u2013M05)')}
          ${renderTable(backItems, 'Back View Metrics (M06\u2013M10)')}
          ${asymSvg ? `<div style="text-align:center;margin-top:12px">${asymSvg}</div>` : ''}
        </div>`;
      })() : '';

      // Dynamo strength table HTML
      const dynamoData = displayReport?.dynamoTests || dynamoTestsList || [];
      const dynamoHtml = dynamoData.length > 0 ? (() => {
        const grouped: Record<string, typeof dynamoData> = {};
        for (const t of dynamoData) { if (!grouped[t.joint]) grouped[t.joint] = []; grouped[t.joint]!.push(t); }
        return `<div class="section">
          <h2>Strength Assessment (VALD Dynamo)</h2>
          ${Object.entries(grouped).map(([joint, tests]) => {
            const calcAsym = (l: number | null | undefined, r: number | null | undefined) => { if (l == null || r == null || (l === 0 && r === 0)) return null; const max = Math.max(l, r), min = Math.min(l, r); return max > 0 ? Math.round(((max - min) / max) * 100) : null; };
            return `<h3 style="color:${BRAND.blue};font-size:13px;margin:10px 0 4px">${joint}</h3>
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
                    ${ri === 0 ? `<td rowspan="${rows.length}" style="font-weight:600;vertical-align:top">${t.movement}${t.position ? `<br><span class="muted" style="font-size:9px">(${t.position})</span>` : ''}</td>` : ''}
                    <td class="muted">${row.label}</td>
                    <td class="center mono">${row.l != null ? row.l : '\u2014'}</td>
                    <td class="center mono">${row.r != null ? row.r : '\u2014'}</td>
                    <td class="center muted">${row.unit}</td>
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
              <h3>${p.title}</h3>
              <p>${p.description}</p>
              ${p.findings && p.findings.length > 0 ? `<ul>${p.findings.map((f: string) => `<li>${f}</li>`).join('')}</ul>` : ''}
            </div>
          `).join('')}
          </div>
        </div>` : '';

      // Management sections HTML
      const mgmt = displayReport?.management;
      const mgmtSections = [
        { label: 'Running Cues', content: mgmt?.runningCues, color: BRAND.green },
        { label: 'Gait Relearning', content: mgmt?.gaitRelearning, color: BRAND.blue },
        { label: 'Mobility Exercises', content: mgmt?.mobilityExercises, color: BRAND.orange },
        { label: 'Strength Exercises', content: mgmt?.strengthExercises, color: '#8B5CF6' },
        { label: 'Running Programming', content: mgmt?.runningProgramming, color: '#6366F1' },
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
<title>Running Assessment Report - ${patientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', 'Source Sans Pro', -apple-system, sans-serif; font-size: 11px; color: ${BRAND.text}; line-height: 1.6; background: ${BRAND.grayLight}; }
  @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
    .page-header { position: fixed; top: 0; left: 0; right: 0; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; }
  }

  /* ===== TYPOGRAPHY ===== */
  h1, h2, h3, h4 { font-family: 'Inter', -apple-system, sans-serif; color: ${BRAND.navy}; }
  .mono { font-family: 'Roboto Mono', 'SF Mono', 'Consolas', monospace; }

  /* ===== COVER PAGE ===== */
  .cover {
    page-break-after: always;
    display: flex; flex-direction: row; align-items: stretch;
    min-height: 0; max-height: 100vh;
    background: white;
    overflow: hidden;
    position: relative;
    padding: 0;
  }
  .cover-left {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 40px 36px 50px;
  }
  .cover-left img { width: 150px; margin-bottom: 24px; }
  .cover-left h1 {
    font-size: 24px; font-weight: 800; color: ${BRAND.navy};
    letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 6px;
    text-transform: uppercase;
  }
  .cover-left .subtitle {
    font-size: 12px; color: ${BRAND.gray}; font-weight: 400;
    letter-spacing: 0.5px;
  }
  .cover-right {
    width: 220px; background: ${BRAND.grayLight}; border-radius: 0 0 0 12px;
    padding: 40px 20px; display: flex; flex-direction: column; justify-content: center;
  }
  .cover-right .info-item { margin-bottom: 12px; }
  .cover-right .info-label {
    font-family: 'Inter', sans-serif; font-size: 7px; text-transform: uppercase;
    letter-spacing: 1.5px; color: ${BRAND.gray}; font-weight: 600; margin-bottom: 2px;
  }
  .cover-right .info-value {
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: ${BRAND.navy};
  }
  .cover-stripe {
    position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, ${BRAND.orange} 0%, ${BRAND.orange} 50%, ${BRAND.green} 50%, ${BRAND.green} 100%);
  }

  /* ===== PAGE HEADER & FOOTER ===== */
  .page-header {
    border-top: 3px solid ${BRAND.navy};
    padding: 8px 0 16px;
    margin-bottom: 24px;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .page-header .header-left {
    font-family: 'Inter', sans-serif; font-size: 8px; text-transform: uppercase;
    letter-spacing: 2px; color: ${BRAND.navy}; font-weight: 700;
  }
  .page-header .header-right {
    font-family: 'Inter', sans-serif; font-size: 8px; text-transform: uppercase;
    letter-spacing: 1px; color: ${BRAND.gray}; font-weight: 500;
  }

  /* ===== SECTIONS ===== */
  .section { margin-bottom: 28px; page-break-inside: avoid; }
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
  .ss-phase-title {
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700;
    color: ${BRAND.navy}; text-transform: uppercase; letter-spacing: 1px;
    margin: 20px 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
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
  <div class="cover-left">
    <img src="${logoBase64}" alt="Total Health" />
    <h1>Running Performance &<br/>Biomechanical Assessment</h1>
    <div class="subtitle">Performance Analysis & Rehabilitation Strategy</div>
  </div>
  <div class="cover-right">
    <div class="info-item"><div class="info-label">Patient</div><div class="info-value">${patientName}</div></div>
    ${patient?.dateOfBirth ? `<div class="info-item"><div class="info-label">Date of Birth</div><div class="info-value">${new Date(patient.dateOfBirth).toLocaleDateString('en-AU')}</div></div>` : ''}
    <div class="info-item"><div class="info-label">Assessment Date</div><div class="info-value">${assessDate}</div></div>
    ${practitionerName ? `<div class="info-item"><div class="info-label">Practitioner</div><div class="info-value">${practitionerName}</div></div>` : ''}
    ${conditionsStr ? `<div class="info-item"><div class="info-label">Testing Conditions</div><div class="info-value" style="font-size:11px;font-weight:400;line-height:1.5">${conditionsStr}</div></div>` : ''}
  </div>
  <div class="cover-stripe"></div>
</div>

<!-- Page Header (repeats on each page via running header concept) -->
<div class="page-header">
  <span class="header-left">Total Health</span>
  <span class="header-right">Running Performance Assessment</span>
</div>

<!-- How to Use This Report -->
<div class="section">
  <h2>How to Use This Report</h2>
  <p style="font-size:11px;line-height:1.7;color:${BRAND.text}">Running analysis evaluates how load is distributed throughout the body during movement. Every individual has a unique running pattern, and there is no absolute &ldquo;right&rdquo; or &ldquo;wrong&rdquo; way to run. The purpose of this assessment is to identify individual strengths, potential weaknesses, and areas for improvement to enhance running economy while reducing injury risk. The data and charts provided serve as objective reference points and checkpoints, allowing comparison and progress tracking following training or intervention. While textbook running mechanics provide useful guidance, there is no single gold-standard gait pattern that every runner must follow.</p>
</div>

<!-- Background -->
${displayReport?.background ? `<div class="section"><h2>Background</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${displayReport.background}</p></div>` : ''}

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
${displayReport?.impressionFromTesting ? `<div style="page-break-before:always"></div><div class="section"><h2>Impression from Testing</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${displayReport.impressionFromTesting}</p></div>` : ''}

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
            return `<li>${cleaned}</li>`;
          }).join('')}</ul>`
        : `<p style="margin:4px 0 0;font-size:10.5px;line-height:1.7;color:${BRAND.text}">${lines[0] || ''}</p>`;
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
${displayReport?.summary ? `<div class="section"><h2>Summary</h2><p style="font-size:11px;line-height:1.7;white-space:pre-wrap">${displayReport.summary}</p></div>` : ''}

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

${inbodyImages.length > 0 ? `
<div class="section" style="page-break-before:always">
  <h2>InBody Body Composition Report</h2>
  ${inbodyImages.map((img: string, i: number) => `<div style="margin-bottom:12px;text-align:center${i > 0 ? ';page-break-before:always' : ''}"><img src="${img}" style="max-width:100%;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08)" alt="InBody page ${i + 1}" /></div>`).join('')}
</div>` : ''}

${vo2Images.length > 0 ? `
<div class="section" style="page-break-before:always">
  <h2>VO2 Master Cardiorespiratory Report</h2>
  ${vo2Images.map((img: string, i: number) => `<div style="margin-bottom:12px;text-align:center${i > 0 ? ';page-break-before:always' : ''}"><img src="${img}" style="max-width:100%;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08)" alt="VO2 page ${i + 1}" /></div>`).join('')}
</div>` : ''}

<!-- Practitioner Sign-off -->
${reportPractitioner ? `<div style="margin-top:48px;padding-top:28px;border-top:3px solid ${BRAND.navy}">
  <p style="font-size:11px;color:${BRAND.gray};margin-bottom:20px;font-family:Inter,sans-serif">Kind regards,</p>
  <p style="font-size:18px;font-weight:800;color:${BRAND.navy};margin:0;font-family:Inter,sans-serif">${reportPractitioner.name}</p>
  ${reportPractitioner.title ? `<p style="font-size:12px;color:${BRAND.blue};margin:4px 0 0;font-family:Inter,sans-serif;font-weight:500">${reportPractitioner.title}${reportPractitioner.qualifications ? `, ${reportPractitioner.qualifications}` : ''}</p>` : ''}
  ${reportPractitioner.clinic ? `<p style="font-size:11px;color:${BRAND.text};margin:12px 0 0;font-weight:600">${reportPractitioner.clinic}</p>` : ''}
  <div style="margin-top:12px;font-size:10px;color:${BRAND.gray};line-height:2.0">
    ${reportPractitioner.phone ? `<p style="margin:0">Phone: ${reportPractitioner.phone}</p>` : ''}
    ${reportPractitioner.email ? `<p style="margin:0">Email: ${reportPractitioner.email}</p>` : ''}
    ${reportPractitioner.website ? `<p style="margin:0">Web: ${reportPractitioner.website}</p>` : ''}
    ${reportPractitioner.address ? `<p style="margin:0">Address: ${reportPractitioner.address}</p>` : ''}
  </div>
</div>` : ''}

<!-- Page Footer -->
<div style="margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-family:Inter,sans-serif;font-size:8px;color:${BRAND.gray};text-transform:uppercase;letter-spacing:1px">
  <span>${patientName}</span>
  <span>Confidential</span>
</div>

</body></html>`;

      toast.dismiss("pdf-prep");

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setExporting(false);
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();

      toast.success("Report opened in new tab. In the print dialog, uncheck 'Headers and footers' for a clean PDF.", { duration: 8000 });
      setExporting(false);
    } catch (err: any) {
      console.error("PDF export error:", err);
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
                value={editingReport?.background || ""}
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

        {/* VO2/InBody files are accessible from their own tabs — not shown in the report preview */}

        {/* Screenshots with annotations */}
        {screenshotsList && screenshotsList.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base text-[#1A2744]">Running Analysis</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {screenshotsList.map(ss => (
                  <AnnotatedScreenshot key={ss.id} screenshot={ss} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
            </CardContent>
          </Card>
        )}

        {/* Left/Right Asymmetry Analysis */}
        {(displayReport?.asymmetryData && displayReport.asymmetryData.length > 0) && (() => {
          const sideItems = displayReport.asymmetryData.filter((a: AsymmetryItem) => a.view === "Side" || (!a.view && !["Pelvic Drop","Step Width","Knee Frontal Plane Angle","Rearfoot Eversion","Trunk Rotation Asym","Hip Rotation (Mid-Swing)","Push-Off Alignment"].includes(a.metricName)));
          const backItems = displayReport.asymmetryData.filter((a: AsymmetryItem) => a.view === "Back" || (!a.view && ["Pelvic Drop","Step Width","Knee Frontal Plane Angle","Rearfoot Eversion","Trunk Rotation Asym","Hip Rotation (Mid-Swing)","Push-Off Alignment"].includes(a.metricName)));
          const renderAsymSection = (items: AsymmetryItem[], title: string) => {
            if (items.length === 0) return null;
            return (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1A2744] text-white">
                        <th className="text-left p-2.5 font-medium text-xs uppercase tracking-wide">Metric</th>
                        <th className="text-center p-2.5 font-medium text-xs uppercase tracking-wide text-[#1A6B9C]">Left</th>
                        <th className="text-center p-2.5 font-medium text-xs uppercase tracking-wide text-[#E8862A]">Right</th>
                        <th className="text-center p-2.5 font-medium text-xs uppercase tracking-wide">Diff (\u00b0)</th>
                        <th className="text-center p-2.5 font-medium text-xs uppercase tracking-wide">Symmetry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a: AsymmetryItem, i: number) => (
                        <tr key={i} className="border-b last:border-0 even:bg-muted/30">
                          <td className="p-2.5 font-medium text-xs">{a.metricName}</td>
                          <td className="p-2.5 text-center text-xs font-mono text-[#1A6B9C]">{a.leftValue !== null ? `${a.leftValue}\u00b0` : "\u2014"}</td>
                          <td className="p-2.5 text-center text-xs font-mono text-[#E8862A]">{a.rightValue !== null ? `${a.rightValue}\u00b0` : "\u2014"}</td>
                          <td className="p-2.5 text-center text-xs font-mono">
                            {a.difference !== null ? (
                              <span>{Math.abs(a.difference)}\u00b0</span>
                            ) : "\u2014"}
                          </td>
                          <td className="p-2.5 text-center text-xs font-mono font-semibold">
                            {a.difference !== null ? (() => {
                              const absDiff = Math.abs(a.difference!);
                              const label = absDiff <= 2 ? "\u2713 Symmetric" : absDiff <= 5 ? "\u26A0 Minor" : "\u26A0 Notable";
                              const cls = absDiff <= 2 ? "text-[#7A9A3B]" : absDiff <= 5 ? "text-[#E8862A]" : "text-red-600";
                              return <span className={cls}>{label}</span>;
                            })() : "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          };
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[#1A2744]">Left vs Right Asymmetry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderAsymSection(sideItems, "Side View Metrics (M01\u2013M05)")}
                {renderAsymSection(backItems, "Back View Metrics (M06\u2013M10)")}
                {displayReport.asymmetryData.some((a: AsymmetryItem) => a.leftValue !== null && a.rightValue !== null) && (
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Visual Comparison</h4>
                    <div className="flex justify-center border rounded-lg p-3 bg-white" dangerouslySetInnerHTML={{ __html: generateAsymmetryChartSVG(displayReport.asymmetryData) }} />
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })()}

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
                value={editingReport?.impressionFromTesting || ""}
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
                        value={p.title}
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
                      value={p.description}
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
                            value={f}
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
                    <h4 className="font-semibold text-[#1A2744]">{p.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    {p.findings && p.findings.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.findings.map((f: string, j: number) => (
                          <li key={j} className="text-sm flex items-start gap-2">
                            <span className="text-[#E8862A] mt-0.5">\u25B8</span>
                            <span>{f}</span>
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
            {isEditing ? (
              <>
                <EditableManagementSection label="Running Cues" value={editingReport?.management?.runningCues || ""} onChange={v => updateField("management.runningCues", v)} color="green" />
                <EditableManagementSection label="Gait Relearning" value={editingReport?.management?.gaitRelearning || ""} onChange={v => updateField("management.gaitRelearning", v)} color="blue" />
                <EditableManagementSection label="Mobility Exercises" value={editingReport?.management?.mobilityExercises || ""} onChange={v => updateField("management.mobilityExercises", v)} color="amber" />
                <EditableManagementSection label="Strength Exercises" value={editingReport?.management?.strengthExercises || ""} onChange={v => updateField("management.strengthExercises", v)} color="purple" />
                <EditableManagementSection label="Running Programming" value={editingReport?.management?.runningProgramming || ""} onChange={v => updateField("management.runningProgramming", v)} color="indigo" />
              </>
            ) : (
              <>
                {displayReport?.management?.runningCues && <ManagementSection label="Running Cues" content={displayReport.management.runningCues} color="green" />}
                {displayReport?.management?.gaitRelearning && <ManagementSection label="Gait Relearning" content={displayReport.management.gaitRelearning} color="blue" />}
                {displayReport?.management?.mobilityExercises && <ManagementSection label="Mobility Exercises" content={displayReport.management.mobilityExercises} color="amber" />}
                {displayReport?.management?.strengthExercises && <ManagementSection label="Strength Exercises" content={displayReport.management.strengthExercises} color="purple" />}
                {displayReport?.management?.runningProgramming && <ManagementSection label="Running Programming" content={displayReport.management.runningProgramming} color="indigo" />}
                {!displayReport?.management?.runningCues && !displayReport?.management?.gaitRelearning && !displayReport?.management?.mobilityExercises && !displayReport?.management?.strengthExercises && !displayReport?.management?.runningProgramming && (
                  <p className="text-sm text-muted-foreground italic">No management recommendations.</p>
                )}
              </>
            )}
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
                value={editingReport?.summary || ""}
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

function ManagementSection({ label, content, color }: { label: string; content: string; color: string }) {
  const c = colorMap[color] || colorMap.green;
  return (
    <div className={`${c.bg} border-l-4 ${c.border} pl-4 py-2.5 rounded-r-lg`}>
      <h4 className={`font-semibold ${c.text} text-sm`}>{label}</h4>
      <PlainText>{content}</PlainText>
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
