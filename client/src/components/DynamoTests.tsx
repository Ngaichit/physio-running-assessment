import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Dumbbell, AlertTriangle, CheckCircle2, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DynamoTestsProps {
  assessmentId: number;
}

const JOINTS = [
  { value: "Hip", label: "Hip" },
  { value: "Knee", label: "Knee" },
  { value: "Ankle", label: "Ankle" },
  { value: "Shoulder", label: "Shoulder" },
  { value: "Elbow", label: "Elbow" },
  { value: "Wrist", label: "Wrist" },
  { value: "Trunk", label: "Trunk" },
  { value: "Cervical", label: "Cervical Spine" },
  { value: "Other", label: "Other" },
];

const MOVEMENTS_BY_JOINT: Record<string, string[]> = {
  Hip: ["Flexion", "Extension", "Abduction", "Adduction", "Internal Rotation", "External Rotation"],
  Knee: ["Flexion", "Extension"],
  Ankle: ["Dorsiflexion", "Plantarflexion", "Inversion", "Eversion"],
  Shoulder: ["Flexion", "Extension", "Abduction", "Adduction", "Internal Rotation", "External Rotation"],
  Elbow: ["Flexion", "Extension", "Pronation", "Supination"],
  Wrist: ["Flexion", "Extension", "Radial Deviation", "Ulnar Deviation"],
  Trunk: ["Flexion", "Extension", "Lateral Flexion", "Rotation"],
  Cervical: ["Flexion", "Extension", "Lateral Flexion", "Rotation"],
  Other: ["Flexion", "Extension", "Abduction", "Adduction", "Rotation", "Other"],
};

const POSITIONS = [
  "Supine", "Prone", "Side-lying (L)", "Side-lying (R)", "Seated", "Standing", "Other"
];

const FORCE_UNITS = ["kg", "N", "lbs"];
const RFD_UNITS = ["N/s", "kg/s"];

export default function DynamoTests({ assessmentId }: DynamoTestsProps) {
  const { data: tests, isLoading } = trpc.dynamo.list.useQuery({ assessmentId });
  const utils = trpc.useUtils();
  const createTest = trpc.dynamo.create.useMutation({
    onSuccess: () => utils.dynamo.list.invalidate({ assessmentId }),
  });
  const updateTest = trpc.dynamo.update.useMutation({
    onSuccess: () => utils.dynamo.list.invalidate({ assessmentId }),
  });
  const deleteTest = trpc.dynamo.delete.useMutation({
    onSuccess: () => utils.dynamo.list.invalidate({ assessmentId }),
  });

  const [addingJoint, setAddingJoint] = useState("");
  const [addingMovement, setAddingMovement] = useState("");
  const [addingPosition, setAddingPosition] = useState("");
  const [addingUnit, setAddingUnit] = useState("kg");

  const handleAddTest = async () => {
    if (!addingJoint || !addingMovement) {
      toast.error("Please select both joint and movement");
      return;
    }
    try {
      await createTest.mutateAsync({
        assessmentId,
        joint: addingJoint,
        movement: addingMovement,
        position: addingPosition || undefined,
        unit: addingUnit,
      });
      setAddingJoint("");
      setAddingMovement("");
      setAddingPosition("");
      toast.success("Test added");
    } catch (err) {
      toast.error("Failed to add test");
    }
  };

  const handleUpdateValue = async (id: number, field: string, value: number | string | null) => {
    try {
      await updateTest.mutateAsync({ id, [field]: value });
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTest.mutateAsync({ id });
      toast.success("Test removed");
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const getAsymmetryBadge = (asymmetry: number | null) => {
    if (asymmetry === null || asymmetry === undefined) return null;
    if (asymmetry <= 10) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" />{asymmetry}%</Badge>;
    if (asymmetry <= 15) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]"><ArrowLeftRight className="w-3 h-3 mr-0.5" />{asymmetry}%</Badge>;
    if (asymmetry <= 25) return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" />{asymmetry}%</Badge>;
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" />{asymmetry}%</Badge>;
  };

  const availableMovements = addingJoint ? (MOVEMENTS_BY_JOINT[addingJoint] || MOVEMENTS_BY_JOINT["Other"]) : [];

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading dynamo tests...</div>;

  // Group tests by joint
  const grouped: Record<string, typeof tests> = {};
  if (tests) {
    for (const t of tests) {
      if (!grouped[t.joint]) grouped[t.joint] = [];
      grouped[t.joint]!.push(t);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add New Test */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Add Strength Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">Joint</Label>
              <Select value={addingJoint} onValueChange={(v) => { setAddingJoint(v); setAddingMovement(""); }}>
                <SelectTrigger><SelectValue placeholder="Select joint" /></SelectTrigger>
                <SelectContent>
                  {JOINTS.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Movement</Label>
              <Select value={addingMovement} onValueChange={setAddingMovement} disabled={!addingJoint}>
                <SelectTrigger><SelectValue placeholder="Select movement" /></SelectTrigger>
                <SelectContent>
                  {availableMovements.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Position</Label>
              <Select value={addingPosition} onValueChange={setAddingPosition}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Force Unit</Label>
              <Select value={addingUnit} onValueChange={setAddingUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORCE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddTest} disabled={createTest.isPending || !addingJoint || !addingMovement} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results by Joint */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No dynamo tests recorded yet</p>
          <p className="text-sm">Add strength measurements using the form above</p>
        </div>
      )}

      {Object.entries(grouped).map(([joint, jointTests]) => (
        <Card key={joint}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{joint}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jointTests!.map((test) => (
                <DynamoTestRow
                  key={test.id}
                  test={test}
                  onUpdate={handleUpdateValue}
                  onDelete={handleDelete}
                  getAsymmetryBadge={getAsymmetryBadge}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Summary Card */}
      {tests && tests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Strength Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{tests.length}</div>
                <div className="text-xs text-muted-foreground">Tests Recorded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {tests.filter(t => t.asymmetryPercent != null && t.asymmetryPercent <= 10).length}
                </div>
                <div className="text-xs text-green-600">Symmetric</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {tests.filter(t => t.asymmetryPercent != null && t.asymmetryPercent > 10 && t.asymmetryPercent <= 15).length}
                </div>
                <div className="text-xs text-yellow-600">Mild Asymmetry</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {tests.filter(t => t.asymmetryPercent != null && t.asymmetryPercent > 15).length}
                </div>
                <div className="text-xs text-red-600">Significant Asymmetry</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DynamoTestRow({ test, onUpdate, onDelete, getAsymmetryBadge }: {
  test: any;
  onUpdate: (id: number, field: string, value: number | string | null) => void;
  onDelete: (id: number) => void;
  getAsymmetryBadge: (v: number | null) => React.ReactNode;
}) {
  const [leftVal, setLeftVal] = useState(test.leftValue?.toString() || "");
  const [rightVal, setRightVal] = useState(test.rightValue?.toString() || "");
  const [leftPF, setLeftPF] = useState(test.leftPeakForce?.toString() || "");
  const [rightPF, setRightPF] = useState(test.rightPeakForce?.toString() || "");
  const [leftRfd, setLeftRfd] = useState(test.leftPeakRfd?.toString() || "");
  const [rightRfd, setRightRfd] = useState(test.rightPeakRfd?.toString() || "");
  const [leftTTP, setLeftTTP] = useState(test.leftTimeToPeak?.toString() || "");
  const [rightTTP, setRightTTP] = useState(test.rightTimeToPeak?.toString() || "");
  const [notes, setNotes] = useState(test.notes || "");

  const handleBlur = (field: string, localVal: string, originalVal: number | null | undefined) => {
    const num = localVal ? parseFloat(localVal) : null;
    if (num !== (originalVal ?? null)) onUpdate(test.id, field, num);
  };

  const calcAsymmetry = (l: string, r: string) => {
    const lv = parseFloat(l);
    const rv = parseFloat(r);
    if (!isNaN(lv) && !isNaN(rv) && (lv > 0 || rv > 0)) {
      const max = Math.max(lv, rv);
      const min = Math.min(lv, rv);
      return max > 0 ? Math.round(((max - min) / max) * 100) : null;
    }
    return null;
  };

  const pfAsymmetry = calcAsymmetry(leftPF, rightPF);
  const rfdAsymmetry = calcAsymmetry(leftRfd, rightRfd);
  const ttpAsymmetry = calcAsymmetry(leftTTP, rightTTP);

  return (
    <div className="border rounded-lg p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{test.movement}</span>
          {test.position && <span className="text-xs text-muted-foreground">({test.position})</span>}
          {getAsymmetryBadge(test.asymmetryPercent)}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onDelete(test.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Measurements grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-1.5 pr-2 text-left font-medium w-[140px]">Measure</th>
              <th className="pb-1.5 px-1 text-center font-medium">Left</th>
              <th className="pb-1.5 px-1 text-center font-medium">Right</th>
              <th className="pb-1.5 px-1 text-center font-medium">Unit</th>
              <th className="pb-1.5 px-1 text-center font-medium">Asymmetry</th>
            </tr>
          </thead>
          <tbody>
            {/* Mean Force / Value */}
            <tr className="border-b last:border-0">
              <td className="py-1.5 pr-2 font-medium">Mean Force</td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={leftVal} onChange={(e) => setLeftVal(e.target.value)}
                  onBlur={() => handleBlur("leftValue", leftVal, test.leftValue)}
                  placeholder="L" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={rightVal} onChange={(e) => setRightVal(e.target.value)}
                  onBlur={() => handleBlur("rightValue", rightVal, test.rightValue)}
                  placeholder="R" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1 text-center text-muted-foreground">{test.unit}</td>
              <td className="py-1.5 px-1 text-center">{getAsymmetryBadge(test.asymmetryPercent)}</td>
            </tr>
            {/* Peak Force */}
            <tr className="border-b last:border-0">
              <td className="py-1.5 pr-2 font-medium">Peak Force</td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={leftPF} onChange={(e) => setLeftPF(e.target.value)}
                  onBlur={() => handleBlur("leftPeakForce", leftPF, test.leftPeakForce)}
                  placeholder="L" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={rightPF} onChange={(e) => setRightPF(e.target.value)}
                  onBlur={() => handleBlur("rightPeakForce", rightPF, test.rightPeakForce)}
                  placeholder="R" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1 text-center text-muted-foreground">{test.peakForceUnit || "N"}</td>
              <td className="py-1.5 px-1 text-center">{pfAsymmetry !== null ? getAsymmetryBadge(pfAsymmetry) : "—"}</td>
            </tr>
            {/* Peak RFD */}
            <tr className="border-b last:border-0">
              <td className="py-1.5 pr-2 font-medium">Peak RFD</td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={leftRfd} onChange={(e) => setLeftRfd(e.target.value)}
                  onBlur={() => handleBlur("leftPeakRfd", leftRfd, test.leftPeakRfd)}
                  placeholder="L" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1">
                <Input type="number" step="0.1" value={rightRfd} onChange={(e) => setRightRfd(e.target.value)}
                  onBlur={() => handleBlur("rightPeakRfd", rightRfd, test.rightPeakRfd)}
                  placeholder="R" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1 text-center text-muted-foreground">{test.peakRfdUnit || "N/s"}</td>
              <td className="py-1.5 px-1 text-center">{rfdAsymmetry !== null ? getAsymmetryBadge(rfdAsymmetry) : "—"}</td>
            </tr>
            {/* Time to Peak Force */}
            <tr className="border-b last:border-0">
              <td className="py-1.5 pr-2 font-medium">Time to Peak</td>
              <td className="py-1.5 px-1">
                <Input type="number" step="1" value={leftTTP} onChange={(e) => setLeftTTP(e.target.value)}
                  onBlur={() => handleBlur("leftTimeToPeak", leftTTP, test.leftTimeToPeak)}
                  placeholder="L" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1">
                <Input type="number" step="1" value={rightTTP} onChange={(e) => setRightTTP(e.target.value)}
                  onBlur={() => handleBlur("rightTimeToPeak", rightTTP, test.rightTimeToPeak)}
                  placeholder="R" className="w-20 h-7 text-center text-xs mx-auto" />
              </td>
              <td className="py-1.5 px-1 text-center text-muted-foreground">ms</td>
              <td className="py-1.5 px-1 text-center">{ttpAsymmetry !== null ? getAsymmetryBadge(ttpAsymmetry) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (test.notes || "")) onUpdate(test.id, "notes", notes || null); }}
          placeholder="Notes for this test..."
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
