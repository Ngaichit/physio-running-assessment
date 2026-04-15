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

export default function MetricsStandards() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<MetricForm>(emptyForm);

  const { data: metrics, isLoading } = trpc.metrics.list.useQuery();
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
          <h1 className="text-2xl font-semibold tracking-tight">Metrics Standards</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure reference target ranges for biomechanical metrics</p>
        </div>
      </div>

      <div className="space-y-6">
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
        </div>

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

    </div>
  );
}
