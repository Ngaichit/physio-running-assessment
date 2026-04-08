import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload, Camera, ChevronLeft, ChevronRight, Play, Pause, Trash2,
  Loader2, Pencil, SkipBack, SkipForward, RotateCcw, Move,
  AlignHorizontalDistributeCenter
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import AnnotationCanvas from "./AnnotationCanvas";

interface Props {
  assessmentId: number;
}

type ViewType = "side_left" | "side_right" | "back";
type GaitPhase = "foot_strike" | "loading" | "push_off" | "swing" | "other";

interface VideoAlignment {
  offsetX: number; // percentage -50 to 50
  offsetY: number; // percentage -50 to 50
  rotation: number; // degrees -10 to 10
  scale: number; // 0.5 to 2
}

const DEFAULT_ALIGNMENT: VideoAlignment = { offsetX: 0, offsetY: 0, rotation: 0, scale: 1 };

const FRAME_STEPS = [
  { label: "1/120s", value: 1 / 120, description: "Ultra fine" },
  { label: "1/60s", value: 1 / 60, description: "Fine" },
  { label: "1/30s", value: 1 / 30, description: "Normal (30fps)" },
  { label: "1/15s", value: 1 / 15, description: "2 frames" },
  { label: "1/10s", value: 1 / 10, description: "3 frames" },
];

export default function VideoAnalysis({ assessmentId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [selectedView, setSelectedView] = useState<ViewType>("side_left");
  const [selectedPhase, setSelectedPhase] = useState<GaitPhase>("foot_strike");
  const [selectedLegSide, setSelectedLegSide] = useState<"left" | "right">("left");
  const [videoSrc, setVideoSrc] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [annotatingScreenshot, setAnnotatingScreenshot] = useState<any>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frameStepIndex, setFrameStepIndex] = useState(2); // default 1/30s
  const [showAlignment, setShowAlignment] = useState(false);
  const [alignments, setAlignments] = useState<Record<string, VideoAlignment>>({
    side_left: { ...DEFAULT_ALIGNMENT },
    side_right: { ...DEFAULT_ALIGNMENT },
    back: { ...DEFAULT_ALIGNMENT },
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeUpdateRef = useRef<number>(0);

  const { data: screenshotsList, isLoading: screenshotsLoading } = trpc.screenshot.list.useQuery({ assessmentId });
  const utils = trpc.useUtils();

  const uploadFile = trpc.upload.uploadFile.useMutation();
  const createScreenshot = trpc.screenshot.create.useMutation({
    onSuccess: () => {
      utils.screenshot.list.invalidate({ assessmentId });
      toast.success("Screenshot captured");
    },
  });
  const deleteScreenshot = trpc.screenshot.delete.useMutation({
    onSuccess: () => {
      utils.screenshot.list.invalidate({ assessmentId });
      toast.success("Screenshot deleted");
    },
  });
  const updateScreenshot = trpc.screenshot.update.useMutation({
    onSuccess: () => {
      utils.screenshot.list.invalidate({ assessmentId });
    },
  });
  const analyzePose = trpc.ai.analyzePose.useMutation();

  // Time update handler
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      // Throttle updates to avoid excessive re-renders
      const now = Date.now();
      if (now - timeUpdateRef.current > 50) {
        setCurrentTime(video.currentTime);
        timeUpdateRef.current = now;
      }
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setCurrentTime(0);
    };
    const handleSeeked = () => {
      setCurrentTime(video.currentTime);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [videoSrc[selectedView]]);

  // Keyboard shortcuts for frame stepping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!videoRef.current || !videoSrc[selectedView]) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          stepFrame(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          stepFrame(1);
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case ",":
          e.preventDefault();
          stepFrame(-1);
          break;
        case ".":
          e.preventDefault();
          stepFrame(1);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedView, videoSrc, frameStepIndex]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      toast.error("Video file too large (max 200MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoSrc(prev => ({ ...prev, [selectedView]: url }));
    toast.success("Video loaded for " + viewLabel(selectedView));
    e.target.value = "";
  };

  const captureScreenshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Apply alignment transforms when capturing
      const align = alignments[selectedView];
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((align.rotation * Math.PI) / 180);
      ctx.scale(align.scale, align.scale);
      ctx.translate(-canvas.width / 2 + (align.offsetX / 100) * canvas.width, -canvas.height / 2 + (align.offsetY / 100) * canvas.height);
      ctx.drawImage(video, 0, 0);
      ctx.restore();

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = dataUrl.split(",")[1];
      const timestamp = video.currentTime;

      const result = await uploadFile.mutateAsync({
        key: `screenshots/${assessmentId}/${Date.now()}.jpg`,
        base64Data: base64,
        contentType: "image/jpeg",
      });

      const newScreenshot = await createScreenshot.mutateAsync({
        assessmentId,
        viewType: selectedView,
        gaitPhase: selectedPhase as any,
        imageUrl: result.url,
        timestamp,
        legSide: selectedView === "back" ? selectedLegSide : undefined,
        sortOrder: (screenshotsList?.length || 0) + 1,
      });

      toast.success("Screenshot captured! Continue capturing more phases.");

      // Run AI analysis in background (non-blocking) if enabled
      if (autoAnalyze && newScreenshot) {
        const ssId = newScreenshot.id;
        setAnalyzingIds(prev => new Set(prev).add(ssId));
        // Fire and forget — don't await, don't block capture flow
        analyzePose.mutateAsync({
          screenshotId: ssId,
          imageUrl: result.url,
          viewType: selectedView,
          gaitPhase: selectedPhase as any,
        }).then((analysisResult) => {
          toast.success(`AI detected ${analysisResult.annotations.length} annotations on ${phaseLabel(selectedPhase)}.`, { duration: 3000 });
          utils.annotation.list.invalidate();
          utils.screenshot.list.invalidate({ assessmentId });
        }).catch(() => {
          toast.warning(`AI analysis failed for ${phaseLabel(selectedPhase)}. You can annotate manually.`);
        }).finally(() => {
          setAnalyzingIds(prev => {
            const next = new Set(prev);
            next.delete(ssId);
            return next;
          });
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to capture screenshot");
    } finally {
      setCapturing(false);
    }
  };

  const stepFrame = (direction: number) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    video.pause();
    setIsPlaying(false);
    const step = FRAME_STEPS[frameStepIndex].value;
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + direction * step));
    video.currentTime = newTime;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleScrub = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const updateAlignment = (key: keyof VideoAlignment, value: number) => {
    setAlignments(prev => ({
      ...prev,
      [selectedView]: { ...prev[selectedView], [key]: value },
    }));
  };

  const resetAlignment = () => {
    setAlignments(prev => ({
      ...prev,
      [selectedView]: { ...DEFAULT_ALIGNMENT },
    }));
  };

  const currentVideoSrc = videoSrc[selectedView];
  const currentAlignment = alignments[selectedView];
  const allScreenshots = screenshotsList || [];

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
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

  const viewLabel = (view: string) => {
    switch (view) {
      case "side_left": return "Left Side";
      case "side_right": return "Right Side";
      case "back": return "Back View";
      default: return view;
    }
  };

  const phaseColor = (phase: string) => {
    switch (phase) {
      case "foot_strike": return "bg-blue-100 text-blue-700 border-blue-200";
      case "loading": case "mid_stance": return "bg-amber-100 text-amber-700 border-amber-200";
      case "push_off": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const videoCount = Object.keys(videoSrc).length;

  const renderScreenshotCard = (ss: any) => (
    <div key={ss.id} className="group relative rounded-lg overflow-hidden border bg-muted/30 cursor-pointer touch-manipulation"
      onClick={() => setAnnotatingScreenshot(ss)}>
      <img src={ss.imageUrl} alt={phaseLabel(ss.gaitPhase)} className="w-full aspect-[4/3] object-cover pointer-events-none" />
      <div className="absolute top-2 left-2 pointer-events-none flex gap-1">
        <Badge variant="outline" className={`${phaseColor(ss.gaitPhase)} text-xs`}>{phaseLabel(ss.gaitPhase)}</Badge>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="h-8 w-8 md:h-7 md:w-7 touch-manipulation" onClick={(e) => { e.stopPropagation(); setAnnotatingScreenshot(ss); }} title="Annotate">
          <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8 md:h-7 md:w-7 text-destructive touch-manipulation" onClick={(e) => { e.stopPropagation(); deleteScreenshot.mutate({ id: ss.id }); }} title="Delete">
          <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
        </Button>
      </div>
      {analyzingIds.has(ss.id) && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/70 text-white px-2.5 py-1.5 rounded-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[10px] font-medium">AI Analyzing...</span>
          </div>
        </div>
      )}
      {ss.timestamp !== null && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <span className="text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">{formatTime(ss.timestamp)}</span>
        </div>
      )}
      {/* Back view: L/R leg side toggle at bottom */}
      {ss.viewType === "back" && (
        <div className="absolute bottom-2 left-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors touch-manipulation ${
              ss.legSide === "left"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-black/40 text-white/70 hover:bg-blue-600/70 hover:text-white"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              updateScreenshot.mutate({ id: ss.id, legSide: ss.legSide === "left" ? null : "left" });
            }}
            title="Tag as Left Leg"
          >L</button>
          <button
            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors touch-manipulation ${
              ss.legSide === "right"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-black/40 text-white/70 hover:bg-red-600/70 hover:text-white"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              updateScreenshot.mutate({ id: ss.id, legSide: ss.legSide === "right" ? null : "right" });
            }}
            title="Tag as Right Leg"
          >R</button>
        </div>
      )}
      {ss.description && (
        <div className="p-2 pointer-events-none">
          <p className="text-xs text-muted-foreground line-clamp-2">{ss.description}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Video Player Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Video Player</CardTitle>
              {videoCount > 0 && (
                <Badge variant="outline" className="text-xs">{videoCount}/3 loaded</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedView} onValueChange={(v: any) => setSelectedView(v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side_left">
                    <span className="flex items-center gap-1.5">Left Side {videoSrc.side_left && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}</span>
                  </SelectItem>
                  <SelectItem value="side_right">
                    <span className="flex items-center gap-1.5">Right Side {videoSrc.side_right && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}</span>
                  </SelectItem>
                  <SelectItem value="back">
                    <span className="flex items-center gap-1.5">Back View {videoSrc.back && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <input type="file" accept="video/*" onChange={handleVideoUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Upload className="h-3 w-3 mr-1" />Upload
                </Button>
              </div>
              {currentVideoSrc && (
                <Button
                  variant={showAlignment ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowAlignment(!showAlignment)}
                >
                  <AlignHorizontalDistributeCenter className="h-3 w-3 mr-1" />Align
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentVideoSrc ? (
            <div className="space-y-3">
              {/* Video with alignment transforms */}
              <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={currentVideoSrc}
                  className="w-full max-h-[500px] object-contain"
                  style={{
                    transform: `translate(${currentAlignment.offsetX}%, ${currentAlignment.offsetY}%) rotate(${currentAlignment.rotation}deg) scale(${currentAlignment.scale})`,
                    transformOrigin: "center center",
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>

              {/* Alignment Controls */}
              {showAlignment && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <Move className="h-3.5 w-3.5" />
                      Video Alignment — {viewLabel(selectedView)}
                    </h4>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAlignment}>
                      <RotateCcw className="h-3 w-3 mr-1" />Reset
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Horizontal Offset</Label>
                        <span className="text-xs text-muted-foreground">{currentAlignment.offsetX.toFixed(1)}%</span>
                      </div>
                      <Slider
                        value={[currentAlignment.offsetX]}
                        onValueChange={([v]) => updateAlignment("offsetX", v)}
                        min={-50} max={50} step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Vertical Offset</Label>
                        <span className="text-xs text-muted-foreground">{currentAlignment.offsetY.toFixed(1)}%</span>
                      </div>
                      <Slider
                        value={[currentAlignment.offsetY]}
                        onValueChange={([v]) => updateAlignment("offsetY", v)}
                        min={-50} max={50} step={0.5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Rotation</Label>
                        <span className="text-xs text-muted-foreground">{currentAlignment.rotation.toFixed(1)}°</span>
                      </div>
                      <Slider
                        value={[currentAlignment.rotation]}
                        onValueChange={([v]) => updateAlignment("rotation", v)}
                        min={-15} max={15} step={0.1}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Scale</Label>
                        <span className="text-xs text-muted-foreground">{currentAlignment.scale.toFixed(2)}x</span>
                      </div>
                      <Slider
                        value={[currentAlignment.scale]}
                        onValueChange={([v]) => updateAlignment("scale", v)}
                        min={0.5} max={2} step={0.01}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adjust to align the runner's position across all video views. Alignment is applied when capturing screenshots.
                  </p>
                </div>
              )}

              {/* Timeline Scrubber */}
              <div className="space-y-1.5">
                <Slider
                  value={[currentTime]}
                  onValueChange={handleScrub}
                  min={0}
                  max={duration || 1}
                  step={0.001}
                  className="cursor-pointer"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{formatTime(currentTime)}</span>
                  <span className="font-mono">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {/* Jump back 1s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.pause();
                        setIsPlaying(false);
                        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1);
                      }
                    }}>
                      <SkipBack className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump back 1s</TooltipContent>
                </Tooltip>

                {/* Step backward */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => stepFrame(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step back ({FRAME_STEPS[frameStepIndex].label})</TooltipContent>
                </Tooltip>

                {/* Play/Pause */}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                {/* Step forward */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => stepFrame(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step forward ({FRAME_STEPS[frameStepIndex].label})</TooltipContent>
                </Tooltip>

                {/* Jump forward 1s */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.pause();
                        setIsPlaying(false);
                        videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 1);
                      }
                    }}>
                      <SkipForward className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump forward 1s</TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Frame step size selector */}
                <Select value={String(frameStepIndex)} onValueChange={(v) => setFrameStepIndex(Number(v))}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAME_STEPS.map((step, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {step.label} — {step.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Gait phase + capture */}
                <Select value={selectedPhase} onValueChange={(v: any) => setSelectedPhase(v)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foot_strike">Foot Strike</SelectItem>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="push_off">Push Off</SelectItem>
                    <SelectItem value="swing">Swing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {/* Leg side selector for back view */}
                {selectedView === "back" && (
                  <div className="flex items-center h-8 rounded-md border bg-muted/50 overflow-hidden">
                    <button
                      className={`px-2.5 h-full text-xs font-medium transition-colors touch-manipulation ${
                        selectedLegSide === "left" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => setSelectedLegSide("left")}
                    >L Leg</button>
                    <button
                      className={`px-2.5 h-full text-xs font-medium transition-colors touch-manipulation ${
                        selectedLegSide === "right" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => setSelectedLegSide("right")}
                    >R Leg</button>
                  </div>
                )}
                <Button size="sm" className="h-8 text-xs" onClick={captureScreenshot} disabled={capturing}>
                  {capturing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                  {capturing ? "Capturing..." : "Capture"}
                </Button>
                {analyzingIds.size > 0 && (
                  <Badge variant="outline" className="text-[10px] h-6 border-blue-300 text-blue-600 animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    AI: {analyzingIds.size} running
                  </Badge>
                )}
              </div>

              {/* Auto-analyze toggle */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Switch checked={autoAnalyze} onCheckedChange={setAutoAnalyze} className="scale-75" />
                  <Label className="text-xs">Auto-detect landmarks with AI after capture</Label>
                </div>
                {analyzing && (
                  <Badge variant="outline" className="text-xs animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    AI detecting landmarks...
                  </Badge>
                )}
              </div>

              {/* Keyboard shortcut hint */}
              <p className="text-xs text-muted-foreground text-center">
                Keyboard: <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">←</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">→</kbd> step frame &nbsp;
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Space</kbd> play/pause &nbsp;
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">,</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">.</kbd> fine step
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Upload a video</h3>
              <p className="text-sm text-muted-foreground mb-4">Select a {viewLabel(selectedView).toLowerCase()} running video to analyze</p>
              <div className="relative">
                <input type="file" accept="video/*" onChange={handleVideoUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Choose Video</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screenshots Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captured Screenshots ({allScreenshots.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {screenshotsLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : allScreenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No screenshots captured yet. Use the video player above to capture frames at key gait phases.</p>
          ) : (
            <div className="space-y-6">
              {(["side_left", "side_right"] as const).map(view => {
                const viewShots = allScreenshots.filter(s => s.viewType === view);
                if (viewShots.length === 0) return null;
                return (
                  <div key={view}>
                    <h3 className="font-medium mb-3 text-sm uppercase tracking-wider text-muted-foreground">{viewLabel(view)}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {viewShots.map(ss => renderScreenshotCard(ss))}
                    </div>
                  </div>
                );
              })}
              {/* Back view — grouped by Left Leg / Right Leg */}
              {(() => {
                const backShots = allScreenshots.filter(s => s.viewType === "back");
                if (backShots.length === 0) return null;
                const leftShots = backShots.filter(s => s.legSide === "left");
                const rightShots = backShots.filter(s => s.legSide === "right");
                const untaggedShots = backShots.filter(s => !s.legSide);
                return (
                  <div>
                    <h3 className="font-medium mb-3 text-sm uppercase tracking-wider text-muted-foreground">Back View</h3>
                    <div className="space-y-4">
                      {leftShots.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium text-blue-700">Left Leg</span>
                            <span className="text-xs text-muted-foreground">({leftShots.length})</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {leftShots.map(ss => renderScreenshotCard(ss))}
                          </div>
                        </div>
                      )}
                      {rightShots.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-sm font-medium text-red-700">Right Leg</span>
                            <span className="text-xs text-muted-foreground">({rightShots.length})</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {rightShots.map(ss => renderScreenshotCard(ss))}
                          </div>
                        </div>
                      )}
                      {untaggedShots.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-gray-400" />
                            <span className="text-sm font-medium text-muted-foreground">Untagged</span>
                            <span className="text-xs text-muted-foreground">({untaggedShots.length})</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {untaggedShots.map(ss => renderScreenshotCard(ss))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden canvas for screenshot capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Annotation Dialog */}
      {annotatingScreenshot && (
        <Dialog open={!!annotatingScreenshot} onOpenChange={() => setAnnotatingScreenshot(null)}>
          <DialogContent className="!max-w-none !sm:max-w-none w-[98vw] h-[93vh] overflow-hidden p-3" style={{ maxWidth: '98vw' }}>
            <DialogHeader>
              <DialogTitle>
                Annotate — {viewLabel(annotatingScreenshot.viewType)}{annotatingScreenshot.viewType === "back" && annotatingScreenshot.legSide ? ` (${annotatingScreenshot.legSide === "left" ? "Left" : "Right"} Leg)` : ""} / {phaseLabel(annotatingScreenshot.gaitPhase)}
              </DialogTitle>
            </DialogHeader>
            <AnnotationCanvas
              screenshot={annotatingScreenshot}
              assessmentId={assessmentId}
              onClose={() => setAnnotatingScreenshot(null)}
              onDescriptionUpdate={(desc: string) => {
                updateScreenshot.mutate({ id: annotatingScreenshot.id, description: desc });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
