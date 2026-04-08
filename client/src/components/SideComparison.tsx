import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight, AlertTriangle, CheckCircle, MinusCircle } from "lucide-react";
import { useState, useMemo } from "react";

interface Props {
  assessmentId: number;
}

interface AsymmetryResult {
  metricId: string;
  metricName: string;
  view: string; // Side or Back
  leftValue: number | null;
  rightValue: number | null;
  difference: number | null;
  percentDiff: number | null;
  rating: "symmetric" | "mild" | "moderate" | "significant" | "incomplete";
  leftScreenshotUrl?: string;
  rightScreenshotUrl?: string;
}

const ASYMMETRY_THRESHOLDS = {
  symmetric: 5,   // <5% difference
  mild: 10,        // 5-10%
  moderate: 15,    // 10-15%
  // >15% = significant
};

function getAsymmetryRating(percentDiff: number | null): AsymmetryResult["rating"] {
  if (percentDiff === null) return "incomplete";
  const abs = Math.abs(percentDiff);
  if (abs < ASYMMETRY_THRESHOLDS.symmetric) return "symmetric";
  if (abs < ASYMMETRY_THRESHOLDS.mild) return "mild";
  if (abs < ASYMMETRY_THRESHOLDS.moderate) return "moderate";
  return "significant";
}

function getRatingColor(rating: AsymmetryResult["rating"]) {
  switch (rating) {
    case "symmetric": return "bg-green-100 text-green-700 border-green-200";
    case "mild": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "moderate": return "bg-orange-100 text-orange-700 border-orange-200";
    case "significant": return "bg-red-100 text-red-700 border-red-200";
    case "incomplete": return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function getRatingLabel(rating: AsymmetryResult["rating"]) {
  switch (rating) {
    case "symmetric": return "Symmetric";
    case "mild": return "Mild Asymmetry";
    case "moderate": return "Moderate Asymmetry";
    case "significant": return "Significant Asymmetry";
    case "incomplete": return "Incomplete";
  }
}

function getRatingIcon(rating: AsymmetryResult["rating"]) {
  switch (rating) {
    case "symmetric": return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "mild": return <MinusCircle className="h-4 w-4 text-yellow-600" />;
    case "moderate": return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case "significant": return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "incomplete": return null;
  }
}

export default function SideComparison({ assessmentId }: Props) {
  const [selectedPhase, setSelectedPhase] = useState<string>("foot_strike");

  const { data: screenshotsList } = trpc.screenshot.list.useQuery({ assessmentId });
  const { data: metricsStandards } = trpc.metrics.list.useQuery();

  // Separate screenshots by view and side
  // Side view: side_left = left, side_right = right
  // Back view: legSide field determines left/right
  const leftSideScreenshots = useMemo(() =>
    (screenshotsList || []).filter((s: any) => s.viewType === "side_left" && s.gaitPhase === selectedPhase),
    [screenshotsList, selectedPhase]
  );
  const rightSideScreenshots = useMemo(() =>
    (screenshotsList || []).filter((s: any) => s.viewType === "side_right" && s.gaitPhase === selectedPhase),
    [screenshotsList, selectedPhase]
  );
  const leftBackScreenshots = useMemo(() =>
    (screenshotsList || []).filter((s: any) => s.viewType === "back" && s.legSide === "left" && s.gaitPhase === selectedPhase),
    [screenshotsList, selectedPhase]
  );
  const rightBackScreenshots = useMemo(() =>
    (screenshotsList || []).filter((s: any) => s.viewType === "back" && s.legSide === "right" && s.gaitPhase === selectedPhase),
    [screenshotsList, selectedPhase]
  );

  // Fetch annotations for left and right screenshots (side view)
  const leftSideIds = leftSideScreenshots.map((s: any) => s.id);
  const rightSideIds = rightSideScreenshots.map((s: any) => s.id);
  const leftBackIds = leftBackScreenshots.map((s: any) => s.id);
  const rightBackIds = rightBackScreenshots.map((s: any) => s.id);

  const { data: leftSideAnns } = trpc.annotation.list.useQuery(
    { screenshotId: leftSideIds[0] || 0 },
    { enabled: leftSideIds.length > 0 }
  );
  const { data: rightSideAnns } = trpc.annotation.list.useQuery(
    { screenshotId: rightSideIds[0] || 0 },
    { enabled: rightSideIds.length > 0 }
  );
  const { data: leftBackAnns } = trpc.annotation.list.useQuery(
    { screenshotId: leftBackIds[0] || 0 },
    { enabled: leftBackIds.length > 0 }
  );
  const { data: rightBackAnns } = trpc.annotation.list.useQuery(
    { screenshotId: rightBackIds[0] || 0 },
    { enabled: rightBackIds.length > 0 }
  );

  // Build asymmetry results for ALL 10 metrics
  const asymmetryResults = useMemo<AsymmetryResult[]>(() => {
    if (!metricsStandards) return [];

    const allMetrics = metricsStandards.filter((m: any) => m.isActive);

    // Build lookup maps for annotations by metric name
    const buildMetricMap = (anns: any[] | undefined): Record<string, number[]> => {
      const map: Record<string, number[]> = {};
      if (!anns) return map;
      for (const ann of anns) {
        if (!ann.metricName || ann.measuredValue == null) continue;
        if (!map[ann.metricName]) map[ann.metricName] = [];
        map[ann.metricName].push(ann.measuredValue);
      }
      return map;
    };

    const leftSideMetrics = buildMetricMap(leftSideAnns);
    const rightSideMetrics = buildMetricMap(rightSideAnns);
    const leftBackMetrics = buildMetricMap(leftBackAnns);
    const rightBackMetrics = buildMetricMap(rightBackAnns);

    const results: AsymmetryResult[] = [];

    for (const metric of allMetrics) {
      const isSideView = metric.view === "Side" || metric.metricCategory?.toLowerCase().includes("side");
      const isBackView = metric.view === "Back" || metric.metricCategory?.toLowerCase().includes("back");

      // Pick the appropriate left/right annotation maps based on view
      let leftMap: Record<string, number[]>;
      let rightMap: Record<string, number[]>;
      let leftScreenshotUrl: string | undefined;
      let rightScreenshotUrl: string | undefined;

      if (isSideView) {
        leftMap = leftSideMetrics;
        rightMap = rightSideMetrics;
        leftScreenshotUrl = leftSideScreenshots[0]?.imageUrl;
        rightScreenshotUrl = rightSideScreenshots[0]?.imageUrl;
      } else if (isBackView) {
        leftMap = leftBackMetrics;
        rightMap = rightBackMetrics;
        leftScreenshotUrl = leftBackScreenshots[0]?.imageUrl;
        rightScreenshotUrl = rightBackScreenshots[0]?.imageUrl;
      } else {
        continue; // Skip metrics without a clear view
      }

      const leftVals = leftMap[metric.metricName];
      const rightVals = rightMap[metric.metricName];
      const leftAvg = leftVals && leftVals.length > 0 ? leftVals.reduce((a: number, b: number) => a + b, 0) / leftVals.length : null;
      const rightAvg = rightVals && rightVals.length > 0 ? rightVals.reduce((a: number, b: number) => a + b, 0) / rightVals.length : null;

      let difference: number | null = null;
      let percentDiff: number | null = null;
      let rating: AsymmetryResult["rating"] = "incomplete";

      if (leftAvg !== null && rightAvg !== null) {
        difference = Math.round((rightAvg - leftAvg) * 10) / 10;
        const avg = (Math.abs(leftAvg) + Math.abs(rightAvg)) / 2;
        percentDiff = avg > 0 ? Math.round((Math.abs(difference) / avg) * 1000) / 10 : 0;
        rating = getAsymmetryRating(percentDiff);
      }

      // Include metric if at least one side has data
      if (leftAvg !== null || rightAvg !== null) {
        results.push({
          metricId: metric.metricId || "",
          metricName: metric.metricName,
          view: isSideView ? "Side" : "Back",
          leftValue: leftAvg !== null ? Math.round(leftAvg * 10) / 10 : null,
          rightValue: rightAvg !== null ? Math.round(rightAvg * 10) / 10 : null,
          difference,
          percentDiff,
          rating,
          leftScreenshotUrl,
          rightScreenshotUrl,
        });
      }
    }

    return results;
  }, [metricsStandards, leftSideAnns, rightSideAnns, leftBackAnns, rightBackAnns, leftSideScreenshots, rightSideScreenshots, leftBackScreenshots, rightBackScreenshots]);

  const sideResults = asymmetryResults.filter(r => r.view === "Side");
  const backResults = asymmetryResults.filter(r => r.view === "Back");
  const hasAnyData = asymmetryResults.length > 0;
  const hasBothSides = asymmetryResults.some(r => r.leftValue !== null && r.rightValue !== null);

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "foot_strike": return "Foot Strike";
      case "loading": case "mid_stance": return "Loading";
      case "push_off": return "Push Off";
      default: return phase;
    }
  };

  const renderTable = (results: AsymmetryResult[], title: string, subtitle: string) => {
    if (results.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 font-medium text-xs">Metric</th>
                <th className="text-center px-3 py-2 font-medium text-xs">Left</th>
                <th className="text-center px-3 py-2 font-medium text-xs">Right</th>
                <th className="text-center px-3 py-2 font-medium text-xs">Diff</th>
                <th className="text-center px-3 py-2 font-medium text-xs">% Diff</th>
                <th className="text-center px-3 py-2 font-medium text-xs">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-medium text-xs">
                    <span className="text-muted-foreground mr-1">{result.metricId}</span>
                    {result.metricName}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    {result.leftValue !== null ? `${result.leftValue}\u00B0` : <span className="text-muted-foreground">\u2014</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    {result.rightValue !== null ? `${result.rightValue}\u00B0` : <span className="text-muted-foreground">\u2014</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    {result.difference !== null ? (
                      <span className={result.difference > 0 ? "text-blue-600" : result.difference < 0 ? "text-orange-600" : ""}>
                        {result.difference > 0 ? "+" : ""}{result.difference}\u00B0
                      </span>
                    ) : <span className="text-muted-foreground">\u2014</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    {result.percentDiff !== null ? `${result.percentDiff}%` : <span className="text-muted-foreground">\u2014</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {result.leftValue !== null && result.rightValue !== null ? (
                      <div className="flex items-center justify-center gap-1">
                        {getRatingIcon(result.rating)}
                        <Badge variant="outline" className={`text-[10px] ${getRatingColor(result.rating)}`}>
                          {getRatingLabel(result.rating)}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Incomplete</span>
                    )}
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
    <div className="space-y-4">
      {/* Phase Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Left vs Right Comparison</CardTitle>
            </div>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="foot_strike">Foot Strike</SelectItem>
                <SelectItem value="loading">Loading</SelectItem>
                <SelectItem value="push_off">Push Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Side-by-side screenshots - Side View */}
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Side View</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">Left Side \u2014 {phaseLabel(selectedPhase)}</h4>
                {leftSideScreenshots.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={leftSideScreenshots[0].imageUrl}
                      alt="Left side"
                      className="w-full aspect-[4/3] object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center aspect-[4/3] bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      No left side screenshot for {phaseLabel(selectedPhase)}.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">Right Side \u2014 {phaseLabel(selectedPhase)}</h4>
                {rightSideScreenshots.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={rightSideScreenshots[0].imageUrl}
                      alt="Right side"
                      className="w-full aspect-[4/3] object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center aspect-[4/3] bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      No right side screenshot for {phaseLabel(selectedPhase)}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Back View screenshots */}
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-4">Back View</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">Left Leg \u2014 {phaseLabel(selectedPhase)}</h4>
                {leftBackScreenshots.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={leftBackScreenshots[0].imageUrl}
                      alt="Back view - Left leg"
                      className="w-full aspect-[4/3] object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center aspect-[4/3] bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      No back view (left leg) for {phaseLabel(selectedPhase)}.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-center">Right Leg \u2014 {phaseLabel(selectedPhase)}</h4>
                {rightBackScreenshots.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    <img
                      src={rightBackScreenshots[0].imageUrl}
                      alt="Back view - Right leg"
                      className="w-full aspect-[4/3] object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center aspect-[4/3] bg-muted/20">
                    <p className="text-xs text-muted-foreground text-center px-4">
                      No back view (right leg) for {phaseLabel(selectedPhase)}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Asymmetry Tables */}
          {hasAnyData ? (
            <div className="space-y-4">
              {renderTable(sideResults, "Side View Metrics", "(M01\u2013M05)")}
              {renderTable(backResults, "Back View Metrics", "(M06–M10)")}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Capture screenshots from both left and right sides to compare.</p>
              <p className="text-xs mt-1">For side view: use Left Side and Right Side views. For back view: select L Leg or R Leg when capturing.</p>
            </div>
          )}

          {/* Summary */}
          {hasBothSides && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Asymmetry Summary \u2014 {phaseLabel(selectedPhase)}</h4>
              <div className="grid grid-cols-4 gap-2">
                {(["symmetric", "mild", "moderate", "significant"] as const).map(rating => {
                  const count = asymmetryResults.filter(r => r.leftValue !== null && r.rightValue !== null && r.rating === rating).length;
                  return (
                    <div key={rating} className={`text-center p-2 rounded-md border ${getRatingColor(rating)}`}>
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px]">{getRatingLabel(rating)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
