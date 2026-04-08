import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Upload, Camera, Wand2, FileDown, FileText, X, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import VideoAnalysis from "@/components/VideoAnalysis";
import ReportPreview from "@/components/ReportPreview";
import DynamoTests from "@/components/DynamoTests";

type Injury = { description: string; date: string; status: string };

function PractitionerSelector({ formData, updateField }: { formData: any; updateField: (field: string, value: any) => void }) {
  const { data: practitioners } = trpc.practitioner.list.useQuery();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Practitioner</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Label>Assessed by</Label>
          <Select
            value={formData.practitionerId ? String(formData.practitionerId) : ""}
            onValueChange={v => updateField("practitionerId", v ? parseInt(v) : null)}
          >
            <SelectTrigger><SelectValue placeholder="Select practitioner..." /></SelectTrigger>
            <SelectContent>
              {practitioners?.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{p.title ? ` — ${p.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!practitioners?.length && (
            <p className="text-xs text-muted-foreground">No practitioners added yet. Go to Practitioners page to add one.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssessmentEditor() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const assessmentId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(tab || "subjective");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: assessment, isLoading } = trpc.assessment.get.useQuery({ id: assessmentId });
  const utils = trpc.useUtils();
  const updateAssessment = trpc.assessment.update.useMutation();
  const generateReport = trpc.ai.generateReport.useMutation();
  const uploadFile = trpc.upload.uploadFile.useMutation();

  useEffect(() => {
    if (assessment && !formData) {
      setFormData({ ...assessment });
      const inj = assessment.injuries;
      if (inj) {
        const parsed = typeof inj === "string" ? JSON.parse(inj) : inj;
        setInjuries(Array.isArray(parsed) ? parsed : []);
      }
    }
    // Sync reportJson from server when it changes (e.g., after report edit save or regeneration)
    if (assessment && formData) {
      const serverReportJson = assessment.reportJson;
      const localReportJson = formData.reportJson;
      // Only update if server has a different reportJson (avoids overwriting user edits in other fields)
      if (JSON.stringify(serverReportJson) !== JSON.stringify(localReportJson)) {
        setFormData((prev: any) => prev ? { ...prev, reportJson: serverReportJson, aiGeneratedReport: assessment.aiGeneratedReport } : prev);
      }
    }
  }, [assessment]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData((prev: any) => prev ? { ...prev, [field]: value } : prev);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      const { id: _id, userId: _u, patientId: _p, createdAt: _c, updatedAt: _up, ...data } = formData;
      await updateAssessment.mutateAsync({ id: assessmentId, ...data, injuries: injuries.length > 0 ? injuries : null });
      utils.assessment.get.invalidate({ id: assessmentId });
      setHasChanges(false);
      toast.success("Assessment saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    // Save first
    await handleSave();
    try {
      const result = await generateReport.mutateAsync({ assessmentId });
      utils.assessment.get.invalidate({ id: assessmentId });
      setFormData((prev: any) => prev ? { ...prev, aiGeneratedReport: JSON.stringify(result.report), reportJson: result.report } : prev);
      toast.success("Report generated successfully");
      setActiveTab("report");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    }
  };

  const addInjury = () => {
    setInjuries(prev => [...prev, { description: "", date: "", status: "current" }]);
    setHasChanges(true);
  };

  const updateInjury = (index: number, field: string, value: string) => {
    setInjuries(prev => prev.map((inj, i) => i === index ? { ...inj, [field]: value } : inj));
    setHasChanges(true);
  };

  const removeInjury = (index: number) => {
    setInjuries(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!assessment || !formData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <p className="text-muted-foreground">Assessment not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/patient/${assessment.patientId}`)} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex items-center gap-2">
          {hasChanges && <Badge variant="outline" className="text-yellow-600 border-yellow-300">Unsaved changes</Badge>}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" onClick={handleGenerateReport} disabled={generateReport.isPending} className="bg-[#2874A6] hover:bg-[#1a5a8a]">
            {generateReport.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="subjective" className="flex-1 text-xs sm:text-sm">Subjective</TabsTrigger>
          <TabsTrigger value="inbody" className="flex-1 text-xs sm:text-sm">InBody</TabsTrigger>
          <TabsTrigger value="vo2" className="flex-1 text-xs sm:text-sm">VO2</TabsTrigger>
          <TabsTrigger value="dynamo" className="flex-1 text-xs sm:text-sm">Dynamo</TabsTrigger>
          <TabsTrigger value="video" className="flex-1 text-xs sm:text-sm">Video Analysis</TabsTrigger>
          <TabsTrigger value="clinical" className="flex-1 text-xs sm:text-sm">Clinical Notes</TabsTrigger>
          <TabsTrigger value="report" className="flex-1 text-xs sm:text-sm">Report</TabsTrigger>
        </TabsList>

        {/* SUBJECTIVE ASSESSMENT */}
        <TabsContent value="subjective" className="space-y-4 mt-4">
          <PractitionerSelector formData={formData} updateField={updateField} />
          <Card>
            <CardHeader><CardTitle className="text-base">Runner Background</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Training Frequency</Label>
                  <Input value={formData.trainingFrequency || ""} onChange={e => updateField("trainingFrequency", e.target.value)} placeholder="e.g. 3x/week" />
                </div>
                <div className="grid gap-2">
                  <Label>Weekly Mileage</Label>
                  <Input value={formData.weeklyMileage || ""} onChange={e => updateField("weeklyMileage", e.target.value)} placeholder="e.g. 20-30km" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Current Pace</Label>
                  <Input value={formData.currentPace || ""} onChange={e => updateField("currentPace", e.target.value)} placeholder="e.g. 5:30/km" />
                </div>
                <div className="grid gap-2">
                  <Label>Preferred Terrain</Label>
                  <Input value={formData.preferredTerrain || ""} onChange={e => updateField("preferredTerrain", e.target.value)} placeholder="e.g. Road, Trail, Treadmill" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Shoe Type</Label>
                  <Input value={formData.shoeType || ""} onChange={e => updateField("shoeType", e.target.value)} placeholder="e.g. Nike Pegasus" />
                </div>
                <div className="grid gap-2">
                  <Label>Cadence (steps/min)</Label>
                  <Input type="number" value={formData.cadence || ""} onChange={e => updateField("cadence", e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 170" />
                </div>
              </div>

              {/* M01 Overstride Category — paired with cadence */}
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-[#2874A6] text-[#2874A6]">M01</Badge>
                  <Label className="font-semibold">Overstride Assessment</Label>
                  <span className="text-xs text-muted-foreground">(paired with cadence)</span>
                </div>
                <p className="text-xs text-muted-foreground">Select the overstride category based on visual assessment of foot placement relative to the centre of mass at initial contact. Consider cadence: low cadence (&lt;160) with overstride = higher injury risk.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm">Overstride Category</Label>
                    <Select value={formData.overstrideCategory || ""} onValueChange={v => updateField("overstrideCategory", v)}>
                      <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="understride">Understride — foot lands behind/under COM</SelectItem>
                        <SelectItem value="optimal">Optimal — foot lands close to under COM</SelectItem>
                        <SelectItem value="mild_overstride">Mild Overstride — foot slightly ahead of COM</SelectItem>
                        <SelectItem value="overstride">Overstride — foot well ahead of COM, excess braking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Cadence Context</Label>
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-sm">
                      {formData.cadence ? (
                        <>
                          <span className="font-mono font-medium">{formData.cadence} spm</span>
                          <span className="text-muted-foreground">—</span>
                          <span className={formData.cadence < 160 ? "text-red-600 font-medium" : formData.cadence < 170 ? "text-amber-600" : "text-green-600"}>
                            {formData.cadence < 160 ? "Low (higher risk)" : formData.cadence < 170 ? "Below average" : formData.cadence < 180 ? "Average" : "Good"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Enter cadence above</span>
                      )}
                    </div>
                  </div>
                </div>
                {formData.overstrideCategory && formData.cadence && formData.cadence < 165 && (formData.overstrideCategory === "mild_overstride" || formData.overstrideCategory === "overstride") && (
                  <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-md p-2">
                    ⚠️ Low cadence + overstride pattern detected. This combination significantly increases braking forces and injury risk at the knee and anterior chain.
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Running Goals</Label>
                <Textarea value={formData.runningGoals || ""} onChange={e => updateField("runningGoals", e.target.value)} placeholder="e.g. Complete a marathon, improve 10K time..." rows={3} />
              </div>
              <div className="grid gap-2">
                <Label>Running Experience</Label>
                <Textarea value={formData.runningExperience || ""} onChange={e => updateField("runningExperience", e.target.value)} placeholder="e.g. Started running in 2023, completed 2 half marathons..." rows={3} />
              </div>
              <div className="grid gap-2">
                <Label>Background Notes</Label>
                <Textarea value={formData.backgroundNotes || ""} onChange={e => updateField("backgroundNotes", e.target.value)} placeholder="Any additional background information about the runner..." rows={4} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Assessment Conditions</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-xs text-muted-foreground">Record the conditions under which the running assessment was performed.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Speed</Label>
                  <Input value={formData.assessmentSpeed || ""} onChange={e => updateField("assessmentSpeed", e.target.value)} placeholder="e.g. 10 km/h" />
                </div>
                <div className="grid gap-2">
                  <Label>Incline</Label>
                  <Input value={formData.assessmentIncline || ""} onChange={e => updateField("assessmentIncline", e.target.value)} placeholder="e.g. 1%" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Footwear</Label>
                  <Input value={formData.assessmentFootwear || ""} onChange={e => updateField("assessmentFootwear", e.target.value)} placeholder="e.g. Nike Pegasus 41" />
                </div>
                <div className="grid gap-2">
                  <Label>Recording Setup</Label>
                  <Input value={formData.assessmentRecording || ""} onChange={e => updateField("assessmentRecording", e.target.value)} placeholder="e.g. Treadmill, 2D video side and back" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Injury History & Concerns</CardTitle>
                <Button variant="outline" size="sm" onClick={addInjury}><Plus className="h-3.5 w-3.5 mr-1" />Add Injury</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {injuries.map((inj, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <Input value={inj.description} onChange={e => updateInjury(i, "description", e.target.value)} placeholder="Injury description" />
                    </div>
                    <div>
                      <Input type="date" value={inj.date} onChange={e => updateInjury(i, "date", e.target.value)} />
                    </div>
                    <div>
                      <Select value={inj.status} onValueChange={v => updateInjury(i, "status", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="recurring">Recurring</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => removeInjury(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {injuries.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No injuries recorded. Click "Add Injury" to add one.</p>}
              <div className="grid gap-2">
                <Label>Concerns / Complaints</Label>
                <Textarea value={formData.concerns || ""} onChange={e => updateField("concerns", e.target.value)} placeholder="e.g. Right knee pain during long runs, tight calves..." rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INBODY */}
        <TabsContent value="inbody" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">InBody Report</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-muted-foreground">Upload the PDF report generated by the InBody equipment.</p>
              <FileUploadArea
                label="InBody PDF"
                accept=".pdf,image/*"
                currentFileUrl={formData.inbodyFileUrl}
                currentFileName={formData.inbodyFileName}
                onUpload={async (file) => {
                  const base64 = await fileToBase64(file);
                  const result = await uploadFile.mutateAsync({
                    key: `inbody/${assessmentId}/${Date.now()}-${file.name}`,
                    base64Data: base64,
                    contentType: file.type,
                  });
                  updateField("inbodyFileUrl", result.url);
                  updateField("inbodyFileName", file.name);
                }}
                onRemove={() => {
                  updateField("inbodyFileUrl", null);
                  updateField("inbodyFileName", null);
                }}
              />
              <div className="grid gap-2">
                <Label>InBody Notes</Label>
                <Textarea value={formData.inbodyNotes || ""} onChange={e => updateField("inbodyNotes", e.target.value)} placeholder="Any observations or notes about the InBody results..." rows={4} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VO2 MASTER */}
        <TabsContent value="vo2" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">VO2 Master Report</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-muted-foreground">Upload the PDF report generated by the VO2 Master equipment.</p>
              <FileUploadArea
                label="VO2 Master PDF"
                accept=".pdf,image/*"
                currentFileUrl={formData.vo2FileUrl}
                currentFileName={formData.vo2FileName}
                onUpload={async (file) => {
                  const base64 = await fileToBase64(file);
                  const result = await uploadFile.mutateAsync({
                    key: `vo2/${assessmentId}/${Date.now()}-${file.name}`,
                    base64Data: base64,
                    contentType: file.type,
                  });
                  updateField("vo2FileUrl", result.url);
                  updateField("vo2FileName", file.name);
                }}
                onRemove={() => {
                  updateField("vo2FileUrl", null);
                  updateField("vo2FileName", null);
                }}
              />
              <div className="grid gap-2">
                <Label>VO2 Notes</Label>
                <Textarea value={formData.vo2Notes || ""} onChange={e => updateField("vo2Notes", e.target.value)} placeholder="Any observations or notes about the VO2 Master results..." rows={4} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VALD DYNAMO */}
        <TabsContent value="dynamo" className="mt-4">
          <DynamoTests assessmentId={assessmentId} />
        </TabsContent>

        {/* VIDEO ANALYSIS */}
        <TabsContent value="video" className="mt-4">
          <VideoAnalysis assessmentId={assessmentId} />
        </TabsContent>


        {/* CLINICAL NOTES */}
        <TabsContent value="clinical" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Clinical Impression</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Clinical Impression</Label>
                <p className="text-xs text-muted-foreground">Write your clinical findings and impression. AI will use this to generate the report.</p>
                <Textarea value={formData.clinicalImpression || ""} onChange={e => updateField("clinicalImpression", e.target.value)} placeholder="e.g. VO2 Master result shows good aerobic capacity. Gait analysis reveals limited hip extension at push off with trunk forward lean..." rows={6} />
              </div>
              <div className="grid gap-2">
                <Label>Things to Improve</Label>
                <p className="text-xs text-muted-foreground">Key areas identified for improvement.</p>
                <Textarea value={formData.thingsToImprove || ""} onChange={e => updateField("thingsToImprove", e.target.value)} placeholder="e.g. 1. Propulsion efficiency - hip extension limited. 2. Upper body posture - forward lean..." rows={5} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Management Plan</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Running Cues</Label>
                <Textarea value={formData.runningCues || ""} onChange={e => updateField("runningCues", e.target.value)} placeholder="e.g. Push off from big toe, stand tall..." rows={3} />
              </div>
              <div className="grid gap-2">
                <Label>Mobility Exercises</Label>
                <Textarea value={formData.mobilityExercises || ""} onChange={e => updateField("mobilityExercises", e.target.value)} placeholder="e.g. Upper thoracic extension, deep neck flexor chin tucking..." rows={4} />
              </div>
              <div className="grid gap-2">
                <Label>Strength Exercises</Label>
                <Textarea value={formData.strengthExercises || ""} onChange={e => updateField("strengthExercises", e.target.value)} placeholder="e.g. Glute bridge 3x20, Single leg calf raise 3x15..." rows={4} />
              </div>
              <div className="grid gap-2">
                <Label>Running Programming</Label>
                <Textarea value={formData.runningProgramming || ""} onChange={e => updateField("runningProgramming", e.target.value)} placeholder="e.g. Gradually increase mileage, focus on Zone 2 running..." rows={4} />
              </div>
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <Label className="font-semibold">Follow-up Reassessment</Label>
                <p className="text-xs text-muted-foreground">Select when the runner should return for a follow-up assessment.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm">Reassess in</Label>
                    <Select
                      value={formData.followUpMonths ? String(formData.followUpMonths) : ""}
                      onValueChange={v => updateField("followUpMonths", v ? parseInt(v) : null)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select timeframe..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 month</SelectItem>
                        <SelectItem value="2">2 months</SelectItem>
                        <SelectItem value="3">3 months</SelectItem>
                        <SelectItem value="4">4 months</SelectItem>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="9">9 months</SelectItem>
                        <SelectItem value="12">12 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Reassessment Date</Label>
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-sm">
                      {formData.followUpMonths && formData.assessmentDate ? (() => {
                        const d = new Date(formData.assessmentDate);
                        d.setMonth(d.getMonth() + formData.followUpMonths);
                        return <span className="font-medium">{d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>;
                      })() : <span className="text-muted-foreground">Select timeframe above</span>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="mt-4">
          <ReportPreview assessmentId={assessmentId} formData={formData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FileUploadArea({ label, accept, currentFileUrl, currentFileName, onUpload, onRemove }: {
  label: string;
  accept: string;
  currentFileUrl: string | null;
  currentFileName: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
      toast.success(`${label} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (currentFileUrl) {
    return (
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
        <FileText className="h-10 w-10 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{currentFileName || label}</p>
          <p className="text-xs text-muted-foreground">Uploaded successfully</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={currentFileUrl} target="_blank" rel="noopener noreferrer" title="View file">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} title="Remove file">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Upload {label}</p>
          <p className="text-xs text-muted-foreground">PDF or image files, max 20MB</p>
        </div>
      )}
    </div>
  );
}
