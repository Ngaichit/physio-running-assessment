import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Pencil, Trash2, Ruler, Download, ArrowDown, ArrowUp, Minus, Target, RotateCcw, GripVertical } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type MetricForm = {
  metricId: string;
  metricName: string;
  metricCategory: string;
  view: string;
  phase: string;
  unit: string;
  description: string;
  whatToMeasure: string;
  linesToDraw: string;
  lowMin: string;
  lowMax: string;
  lowFinding: string;
  optimalMin: string;
  optimalMax: string;
  highMin: string;
  highMax: string;
  highFinding: string;
  lowLoadShift: string;
  highLoadShift: string;
  isHigherBetter: boolean;
};

const emptyForm: MetricForm = {
  metricId: "", metricName: "", metricCategory: "", view: "", phase: "",
  unit: "degrees", description: "", whatToMeasure: "", linesToDraw: "",
  lowMin: "", lowMax: "", lowFinding: "",
  optimalMin: "", optimalMax: "",
  highMin: "", highMax: "", highFinding: "",
  lowLoadShift: "", highLoadShift: "",
  isHigherBetter: false,
};

type AbilityGroupForm = {
  groupId: string;
  label: string;
  color: string;
  metricIds: string[];
  metricWeights: Record<string, number>;
  sortOrder: number;
};

const emptyGroupForm: AbilityGroupForm = {
  groupId: "",
  label: "",
  color: "#2874A6",
  metricIds: [],
  metricWeights: {},
  sortOrder: 0,
};

export default function MetricsStandards() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<MetricForm>(emptyForm);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState<AbilityGroupForm>(emptyGroupForm);

  const { data: metrics, isLoading } = trpc.metrics.list.useQuery();
  const { data: abilityGroups, isLoading: groupsLoading } = trpc.abilityGroup.list.useQuery();
  const utils = trpc.useUtils();

  const seedDefaults = trpc.metrics.seedDefaults.useMutation({
    onSuccess: (result) => {
      utils.metrics.list.invalidate();
      toast.success(result.message);
    },
  });

  const createMetric = trpc.metrics.create.useMutation({
    onSuccess: () => {
      utils.metrics.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Metric created");
    },
  });

  const updateMetric = trpc.metrics.update.useMutation({
    onSuccess: () => {
      utils.metrics.list.invalidate();
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      toast.success("Metric updated");
    },
  });

  const deleteMetric = trpc.metrics.delete.useMutation({
    onSuccess: () => {
      utils.metrics.list.invalidate();
      toast.success("Metric deleted");
    },
  });

  // Ability Group mutations
  const seedGroupDefaults = trpc.abilityGroup.seedDefaults.useMutation({
    onSuccess: (result) => {
      utils.abilityGroup.list.invalidate();
      toast.success(result.message);
    },
  });

  const resetGroups = trpc.abilityGroup.reset.useMutation({
    onSuccess: () => {
      utils.abilityGroup.list.invalidate();
      toast.success("Ability groups reset to defaults");
    },
  });

  const createGroup = trpc.abilityGroup.create.useMutation({
    onSuccess: () => {
      utils.abilityGroup.list.invalidate();
      setGroupDialogOpen(false);
      setGroupForm(emptyGroupForm);
      toast.success("Ability group created");
    },
  });

  const updateGroup = trpc.abilityGroup.update.useMutation({
    onSuccess: () => {
      utils.abilityGroup.list.invalidate();
      setGroupDialogOpen(false);
      setEditGroupId(null);
      setGroupForm(emptyGroupForm);
      toast.success("Ability group updated");
    },
  });

  const deleteGroup = trpc.abilityGroup.delete.useMutation({
    onSuccess: () => {
      utils.abilityGroup.list.invalidate();
      toast.success("Ability group deleted");
    },
  });

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (m: any) => {
    setEditId(m.id);
    setForm({
      metricId: m.metricId || "",
      metricName: m.metricName,
      metricCategory: m.metricCategory,
      view: m.view || "",
      phase: m.phase || "",
      unit: m.unit || "degrees",
      description: m.description || "",
      whatToMeasure: m.whatToMeasure || "",
      linesToDraw: m.linesToDraw || "",
      lowMin: m.lowMin?.toString() || "",
      lowMax: m.lowMax?.toString() || "",
      lowFinding: m.lowFinding || "",
      optimalMin: m.optimalMin?.toString() || "",
      optimalMax: m.optimalMax?.toString() || "",
      highMin: m.highMin?.toString() || "",
      highMax: m.highMax?.toString() || "",
      highFinding: m.highFinding || "",
      lowLoadShift: m.lowLoadShift || "",
      highLoadShift: m.highLoadShift || "",
      isHigherBetter: m.isHigherBetter ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.metricName.trim() || !form.metricCategory.trim()) {
      toast.error("Name and category are required");
      return;
    }
    const data: any = {
      metricId: form.metricId || undefined,
      metricName: form.metricName.trim(),
      metricCategory: form.metricCategory.trim(),
      view: form.view || undefined,
      phase: form.phase || undefined,
      unit: form.unit || undefined,
      description: form.description || undefined,
      whatToMeasure: form.whatToMeasure || undefined,
      linesToDraw: form.linesToDraw || undefined,
      lowMin: form.lowMin ? parseFloat(form.lowMin) : undefined,
      lowMax: form.lowMax ? parseFloat(form.lowMax) : undefined,
      lowFinding: form.lowFinding || undefined,
      optimalMin: form.optimalMin ? parseFloat(form.optimalMin) : undefined,
      optimalMax: form.optimalMax ? parseFloat(form.optimalMax) : undefined,
      highMin: form.highMin ? parseFloat(form.highMin) : undefined,
      highMax: form.highMax ? parseFloat(form.highMax) : undefined,
      highFinding: form.highFinding || undefined,
      lowLoadShift: form.lowLoadShift || undefined,
      highLoadShift: form.highLoadShift || undefined,
      isHigherBetter: form.isHigherBetter,
    };
    if (editId) {
      updateMetric.mutate({ id: editId, ...data });
    } else {
      createMetric.mutate(data);
    }
  };

  // Ability group handlers
  const openCreateGroup = () => {
    setEditGroupId(null);
    setGroupForm({
      ...emptyGroupForm,
      sortOrder: (abilityGroups?.length || 0) + 1,
    });
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: any) => {
    setEditGroupId(g.id);
    setGroupForm({
      groupId: g.groupId,
      label: g.label,
      color: g.color,
      metricIds: (g.metricIds as string[]) || [],
      metricWeights: (g.metricWeights as Record<string, number>) || {},
      sortOrder: g.sortOrder || 0,
    });
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupForm.label.trim() || !groupForm.groupId.trim()) {
      toast.error("Group ID and label are required");
      return;
    }
    if (groupForm.metricIds.length === 0) {
      toast.error("Select at least one metric for this group");
      return;
    }
    if (editGroupId) {
      updateGroup.mutate({ id: editGroupId, ...groupForm });
    } else {
      createGroup.mutate(groupForm);
    }
  };

  const toggleMetricInGroup = (metricId: string) => {
    setGroupForm(f => {
      const removing = f.metricIds.includes(metricId);
      const newIds = removing ? f.metricIds.filter(id => id !== metricId) : [...f.metricIds, metricId];
      const newWeights = { ...f.metricWeights };
      if (removing) {
        delete newWeights[metricId];
      } else if (!(metricId in newWeights)) {
        newWeights[metricId] = 1.0; // default weight
      }
      return { ...f, metricIds: newIds, metricWeights: newWeights };
    });
  };

  const updateMetricWeight = (metricId: string, weight: number) => {
    setGroupForm(f => ({
      ...f,
      metricWeights: { ...f.metricWeights, [metricId]: weight },
    }));
  };

  // Available metrics for group assignment
  const availableMetrics = useMemo(() => {
    return (metrics || []).filter(m => m.isActive && m.metricId).map(m => ({
      id: m.metricId!,
      name: m.metricName,
      view: m.view,
    }));
  }, [metrics]);

  const sideMetrics = (metrics || []).filter(m => m.view === "Side" || m.metricCategory === "Side View");
  const backMetrics = (metrics || []).filter(m => m.view === "Back" || m.metricCategory === "Back View");

  const renderMetricCard = (m: any) => (
    <Card key={m.id} className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {m.metricId && <Badge className="bg-[#1a3a5c] text-white text-xs font-mono">{m.metricId}</Badge>}
              <h3 className="font-medium">{m.metricName}</h3>
              {m.phase && <Badge variant="outline" className="text-xs">{m.phase}</Badge>}
              {m.whatToMeasure && <span className="text-xs text-muted-foreground">{m.whatToMeasure}</span>}
            </div>
            {m.linesToDraw && <p className="text-xs text-muted-foreground mb-2">Lines: {m.linesToDraw}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                <ArrowDown className="h-3 w-3 mr-1" />
                Low: {m.lowFinding || `${m.lowMin ?? "?"} – ${m.lowMax ?? "?"}`}
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                <Minus className="h-3 w-3 mr-1" />
                Ref. Target: {m.optimalMin ?? "?"} – {m.optimalMax ?? "?"}°
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                <ArrowUp className="h-3 w-3 mr-1" />
                High: {m.highFinding || `${m.highMin ?? "?"} – ${m.highMax ?? "?"}`}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {m.lowLoadShift && m.lowLoadShift !== "—" && (
                <span className="text-xs text-blue-600">Low → {m.lowLoadShift}</span>
              )}
              {m.highLoadShift && m.highLoadShift !== "—" && (
                <span className="text-xs text-orange-600">High → {m.highLoadShift}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMetric.mutate({ id: m.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics & Scoring Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure metrics, scoring ranges, and ability groupings for the radar chart</p>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Metric Standards
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Scoring & Grouping
          </TabsTrigger>
        </TabsList>

        {/* ===== METRICS TAB ===== */}
        <TabsContent value="metrics" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">10-Metric Running Assessment</h2>
              <p className="text-sm text-muted-foreground">Configure Low / Reference Target / High ranges and load shift data for each metric</p>
            </div>
            <div className="flex items-center gap-2">
              {(!metrics || metrics.length === 0) && (
                <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                  {seedDefaults.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Load 10 Defaults
                </Button>
              )}
              {metrics && metrics.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm("This will delete all current metrics and replace them with the 10-metric defaults (M01-M10). Continue?")) seedDefaults.mutate({ force: true }); }} disabled={seedDefaults.isPending}>
                  {seedDefaults.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Reset to 10 Defaults
                </Button>
              )}
              <Button onClick={openCreate} className="bg-[#2874A6] hover:bg-[#1a5276]"><Plus className="h-4 w-4 mr-2" />Add Metric</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !metrics || metrics.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Ruler className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No metrics configured</h3>
                <p className="text-sm text-muted-foreground mb-4">Load the 10-metric running assessment defaults</p>
                <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                  {seedDefaults.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Load 10 Default Metrics
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {sideMetrics.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-sm bg-[#1a3a5c]/5 border-[#1a3a5c]/20 text-[#1a3a5c]">Side View</Badge>
                    <span className="text-sm text-muted-foreground font-normal">M01–M05</span>
                  </h2>
                  <div className="grid gap-3">
                    {sideMetrics.map(renderMetricCard)}
                  </div>
                </div>
              )}
              {backMetrics.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-sm bg-[#1a3a5c]/5 border-[#1a3a5c]/20 text-[#1a3a5c]">Back View</Badge>
                    <span className="text-sm text-muted-foreground font-normal">M06–M10</span>
                  </h2>
                  <div className="grid gap-3">
                    {backMetrics.map(renderMetricCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ===== SCORING & GROUPING TAB ===== */}
        <TabsContent value="scoring" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Ability Groups (Radar Chart)</h2>
              <p className="text-sm text-muted-foreground">
                Define how metrics are grouped into ability categories for the performance radar chart.
                Each group aggregates its assigned metrics into a single score (0–100).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(!abilityGroups || abilityGroups.length === 0) && (
                <Button variant="outline" onClick={() => seedGroupDefaults.mutate()} disabled={seedGroupDefaults.isPending}>
                  {seedGroupDefaults.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Load Defaults
                </Button>
              )}
              {abilityGroups && abilityGroups.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm("Reset all ability groups to defaults? This will delete your current groups.")) resetGroups.mutate(); }} disabled={resetGroups.isPending}>
                  {resetGroups.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Reset to Defaults
                </Button>
              )}
              <Button onClick={openCreateGroup} className="bg-[#2874A6] hover:bg-[#1a5276]"><Plus className="h-4 w-4 mr-2" />Add Group</Button>
            </div>
          </div>

          {/* Scoring Logic Explanation */}
          <Card className="bg-[#f8fafc] border-[#e2e8f0]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[#1a365d] flex items-center gap-2">
                <Target className="h-4 w-4" />
                Scoring Logic
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Each metric is scored 0–100 based on how close its measured value is to the optimal range:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
                    <span className="font-medium text-[#16a34a]">Reference Target = 90 pts</span>
                  </div>
                  <p className="text-xs">Value falls within the optimal range</p>
                </div>
                <div className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-[#D68910]" />
                    <span className="font-medium text-[#D68910]">Near Reference Target = 50–89 pts</span>
                  </div>
                  <p className="text-xs">Value is close to optimal range</p>
                </div>
                <div className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-[#dc2626]" />
                    <span className="font-medium text-[#dc2626]">Far from Reference Target = 15–49 pts</span>
                  </div>
                  <p className="text-xs">Value deviates significantly from optimal</p>
                </div>
              </div>
              <p className="text-xs mt-2 italic">
                Category-based metrics (e.g., Overstride, Push-Off): Reference Target = 90, Low/High = 40.
                Group score = average of all assigned metric scores. Groups with no measured metrics are hidden from the chart.
              </p>
            </CardContent>
          </Card>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !abilityGroups || abilityGroups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Target className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No ability groups configured</h3>
                <p className="text-sm text-muted-foreground mb-4">Load the default 5-group configuration for the radar chart</p>
                <Button variant="outline" onClick={() => seedGroupDefaults.mutate()} disabled={seedGroupDefaults.isPending}>
                  {seedGroupDefaults.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Load Default Groups
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {abilityGroups.map((g: any) => {
                const assignedMetrics = (g.metricIds as string[]).map(id => {
                  const m = (metrics || []).find(m => m.metricId === id);
                  return m ? { id: m.metricId!, name: m.metricName } : { id, name: id };
                });
                return (
                  <Card key={g.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className="w-4 h-4 rounded-full shrink-0 border-2"
                              style={{ backgroundColor: g.color, borderColor: g.color }}
                            />
                            <h3 className="font-semibold text-base">{g.label}</h3>
                            <Badge variant="outline" className="text-xs font-mono">{g.groupId}</Badge>
                            {!g.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                            <span className="text-xs text-muted-foreground">Order: {g.sortOrder}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-xs text-muted-foreground mr-1">Metrics:</span>
                            {assignedMetrics.map(m => {
                              const w = (g.metricWeights as Record<string, number>)?.[m.id];
                              return (
                                <Badge key={m.id} className="bg-[#1a3a5c] text-white text-xs font-mono">
                                  {m.id} <span className="font-normal ml-1 opacity-80">{m.name}</span>
                                  {w != null && w !== 1.0 && <span className="ml-1 text-yellow-300">×{w}</span>}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => openEditGroup(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete "${g.label}" group?`)) deleteGroup.mutate({ id: g.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Metric-to-Group Assignment Overview */}
          {abilityGroups && abilityGroups.length > 0 && metrics && metrics.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#1a365d]">Metric Assignment Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-[#1a365d] text-white">
                        <th className="text-left p-2 font-medium text-xs uppercase tracking-wide">Metric</th>
                        {abilityGroups.map((g: any) => (
                          <th key={g.id} className="text-center p-2 font-medium text-xs uppercase tracking-wide" style={{ color: g.color }}>
                            {g.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics || []).filter(m => m.isActive && m.metricId).map((m: any) => (
                        <tr key={m.id} className="border-b last:border-0 even:bg-muted/30">
                          <td className="p-2 text-xs">
                            <span className="font-mono font-semibold text-[#1a3a5c] mr-2">{m.metricId}</span>
                            {m.metricName}
                          </td>
                          {abilityGroups.map((g: any) => {
                            const isAssigned = ((g.metricIds as string[]) || []).includes(m.metricId);
                            return (
                              <td key={g.id} className="p-2 text-center">
                                {isAssigned ? (
                                  <div className="w-5 h-5 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: g.color }}>
                                    <span className="text-white text-[10px] font-bold">✓</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Metric Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Metric" : "Add Metric"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>ID (e.g. M01)</Label>
                <Input value={form.metricId} onChange={e => setForm(f => ({ ...f, metricId: e.target.value }))} placeholder="M01" />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Metric Name *</Label>
                <Input value={form.metricName} onChange={e => setForm(f => ({ ...f, metricName: e.target.value }))} placeholder="e.g. Overstride Angle" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>View</Label>
                <Input value={form.view} onChange={e => setForm(f => ({ ...f, view: e.target.value }))} placeholder="Side / Back" />
              </div>
              <div className="grid gap-2">
                <Label>Phase</Label>
                <Input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} placeholder="IC / Loading" />
              </div>
              <div className="grid gap-2">
                <Label>Category *</Label>
                <Input value={form.metricCategory} onChange={e => setForm(f => ({ ...f, metricCategory: e.target.value }))} placeholder="Side View" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>What to Measure</Label>
                <Input value={form.whatToMeasure} onChange={e => setForm(f => ({ ...f, whatToMeasure: e.target.value }))} placeholder="Forward angle (°)" />
              </div>
              <div className="grid gap-2">
                <Label>Lines to Draw</Label>
                <Input value={form.linesToDraw} onChange={e => setForm(f => ({ ...f, linesToDraw: e.target.value }))} placeholder="Vertical GT + GT→Heel" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            {/* Low Range */}
            <div className="space-y-2 border-l-4 border-blue-400 pl-3">
              <h4 className="font-medium text-sm text-blue-700">Low Range</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Min</Label>
                  <Input type="number" value={form.lowMin} onChange={e => setForm(f => ({ ...f, lowMin: e.target.value }))} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Max</Label>
                  <Input type="number" value={form.lowMax} onChange={e => setForm(f => ({ ...f, lowMax: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Low Finding</Label>
                  <Input value={form.lowFinding} onChange={e => setForm(f => ({ ...f, lowFinding: e.target.value }))} placeholder="<5° Understride" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Load Shift (Low)</Label>
                  <Input value={form.lowLoadShift} onChange={e => setForm(f => ({ ...f, lowLoadShift: e.target.value }))} placeholder="↑ Hip flexor demand" />
                </div>
              </div>
            </div>

            {/* Reference Target Range */}
            <div className="space-y-2 border-l-4 border-green-400 pl-3">
              <h4 className="font-medium text-sm text-green-700">Reference Target Range</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Min</Label>
                  <Input type="number" value={form.optimalMin} onChange={e => setForm(f => ({ ...f, optimalMin: e.target.value }))} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Max</Label>
                  <Input type="number" value={form.optimalMax} onChange={e => setForm(f => ({ ...f, optimalMax: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* High Range */}
            <div className="space-y-2 border-l-4 border-orange-400 pl-3">
              <h4 className="font-medium text-sm text-orange-700">High Range</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Min</Label>
                  <Input type="number" value={form.highMin} onChange={e => setForm(f => ({ ...f, highMin: e.target.value }))} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Max</Label>
                  <Input type="number" value={form.highMax} onChange={e => setForm(f => ({ ...f, highMax: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">High Finding</Label>
                  <Input value={form.highFinding} onChange={e => setForm(f => ({ ...f, highFinding: e.target.value }))} placeholder=">15° Excess braking" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Load Shift (High)</Label>
                  <Input value={form.highLoadShift} onChange={e => setForm(f => ({ ...f, highLoadShift: e.target.value }))} placeholder="↑ PF joint & anterior knee" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMetric.isPending || updateMetric.isPending} className="bg-[#2874A6] hover:bg-[#1a5276]">
              {(createMetric.isPending || updateMetric.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? "Save Changes" : "Create Metric"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ability Group Edit Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGroupId ? "Edit Ability Group" : "Add Ability Group"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Group ID *</Label>
                <Input
                  value={groupForm.groupId}
                  onChange={e => setGroupForm(f => ({ ...f, groupId: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g. shock_absorption"
                />
                <p className="text-xs text-muted-foreground">Unique identifier (snake_case)</p>
              </div>
              <div className="grid gap-2">
                <Label>Display Label *</Label>
                <Input
                  value={groupForm.label}
                  onChange={e => setGroupForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Shock Absorption"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={groupForm.color}
                    onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={groupForm.color}
                    onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))}
                    placeholder="#2874A6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={groupForm.sortOrder}
                  onChange={e => setGroupForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Metric Selection */}
            <div className="grid gap-2">
              <Label>Assigned Metrics *</Label>
              <p className="text-xs text-muted-foreground">Select which metrics contribute to this ability group's score and adjust their weight</p>
              <div className="border rounded-lg p-3 space-y-1.5 max-h-[300px] overflow-y-auto bg-muted/30">
                {availableMetrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2 text-center">No active metrics found. Add metrics first.</p>
                ) : (
                  availableMetrics.map(m => {
                    const isSelected = groupForm.metricIds.includes(m.id);
                    const weight = groupForm.metricWeights[m.id] ?? 1.0;
                    return (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-[#2874A6]/10 border border-[#2874A6]/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMetricInGroup(m.id)}
                            className="rounded border-gray-300"
                          />
                          <Badge className="bg-[#1a3a5c] text-white text-xs font-mono shrink-0">{m.id}</Badge>
                          <span className="text-sm">{m.name}</span>
                          {m.view && <span className="text-xs text-muted-foreground ml-auto">{m.view}</span>}
                        </label>
                        {isSelected && (
                          <div className="flex items-center gap-3 mt-2 ml-8 pl-1">
                            <span className="text-xs text-muted-foreground w-12 shrink-0">Weight:</span>
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              value={weight}
                              onChange={e => updateMetricWeight(m.id, parseFloat(e.target.value))}
                              className="flex-1 h-1.5 accent-[#2874A6]"
                            />
                            <input
                              type="number"
                              min="0"
                              max="3"
                              step="0.1"
                              value={weight}
                              onChange={e => updateMetricWeight(m.id, parseFloat(e.target.value) || 0)}
                              className="w-16 text-center text-xs border rounded px-1 py-0.5 bg-background"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {groupForm.metricIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{groupForm.metricIds.length} metric(s) selected: {groupForm.metricIds.join(', ')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={createGroup.isPending || updateGroup.isPending} className="bg-[#2874A6] hover:bg-[#1a5276]">
              {(createGroup.isPending || updateGroup.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editGroupId ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
