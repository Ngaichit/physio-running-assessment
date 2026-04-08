import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Calendar, Loader2, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [newAssessmentOpen, setNewAssessmentOpen] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: patient, isLoading: patientLoading } = trpc.patient.get.useQuery({ id: patientId });
  const { data: assessmentsList, isLoading: assessmentsLoading } = trpc.assessment.list.useQuery({ patientId });
  const utils = trpc.useUtils();

  const [editForm, setEditForm] = useState<any>(null);

  const updatePatient = trpc.patient.update.useMutation({
    onSuccess: () => {
      utils.patient.get.invalidate({ id: patientId });
      utils.patient.list.invalidate();
      setEditOpen(false);
      toast.success("Patient updated");
    },
  });

  const deletePatient = trpc.patient.delete.useMutation({
    onSuccess: () => {
      utils.patient.list.invalidate();
      setLocation("/");
      toast.success("Patient deleted");
    },
  });

  const createAssessment = trpc.assessment.create.useMutation({
    onSuccess: (newId) => {
      utils.assessment.list.invalidate({ patientId });
      setNewAssessmentOpen(false);
      setLocation(`/assessment/${newId}`);
      toast.success("Assessment created");
    },
  });

  const deleteAssessment = trpc.assessment.delete.useMutation({
    onSuccess: () => {
      utils.assessment.list.invalidate({ patientId });
      toast.success("Assessment deleted");
    },
  });

  if (patientLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <p className="text-muted-foreground">Patient not found</p>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      name: patient.name,
      dateOfBirth: patient.dateOfBirth || "",
      gender: patient.gender || "",
      height: patient.height?.toString() || "",
      weight: patient.weight?.toString() || "",
      email: patient.email || "",
      phone: patient.phone || "",
      notes: patient.notes || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    updatePatient.mutate({
      id: patientId,
      name: editForm.name.trim(),
      dateOfBirth: editForm.dateOfBirth || undefined,
      gender: editForm.gender || undefined,
      height: editForm.height ? parseFloat(editForm.height) : undefined,
      weight: editForm.weight ? parseFloat(editForm.weight) : undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      notes: editForm.notes || undefined,
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "in_progress": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Patients
      </Button>

      {/* Patient Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#2874A6]/10 flex items-center justify-center shrink-0">
                <span className="text-2xl font-semibold text-[#2874A6]">{patient.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold">{patient.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                  {patient.gender && <span className="capitalize">{patient.gender}</span>}
                  {patient.dateOfBirth && <span>DOB: {patient.dateOfBirth}</span>}
                  {patient.height && <span>{patient.height} cm</span>}
                  {patient.weight && <span>{patient.weight} kg</span>}
                </div>
                {(patient.email || patient.phone) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    {patient.email && <span>{patient.email}</span>}
                    {patient.phone && <span>{patient.phone}</span>}
                  </div>
                )}
                {patient.notes && <p className="text-sm text-muted-foreground mt-2">{patient.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete {patient.name} and all their assessments. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deletePatient.mutate({ id: patientId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assessments */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assessments</h2>
        <Dialog open={newAssessmentOpen} onOpenChange={setNewAssessmentOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#2874A6] hover:bg-[#1a5a8a]"><Plus className="h-4 w-4 mr-1" />New Assessment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Running Assessment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Assessment Date</Label>
                <Input type="date" value={assessmentDate} onChange={e => setAssessmentDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewAssessmentOpen(false)}>Cancel</Button>
              <Button onClick={() => createAssessment.mutate({ patientId, assessmentDate })} disabled={createAssessment.isPending}>
                {createAssessment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {assessmentsLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !assessmentsList || assessmentsList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">No assessments yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a new running assessment for this patient</p>
            <Button variant="outline" size="sm" onClick={() => setNewAssessmentOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />New Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {assessmentsList.map(a => (
            <Card key={a.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation(`/assessment/${a.id}`)}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Assessment - {a.assessmentDate}</h3>
                    <Badge variant="outline" className={statusColor(a.status)}>{a.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Created {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={e => e.stopPropagation()}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this assessment and all its data.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAssessment.mutate({ id: a.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Full Name *</Label>
                <Input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm((f: any) => ({ ...f, dateOfBirth: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Gender</Label>
                  <Select value={editForm.gender} onValueChange={v => setEditForm((f: any) => ({ ...f, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Height (cm)</Label>
                  <Input type="number" value={editForm.height} onChange={e => setEditForm((f: any) => ({ ...f, height: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" value={editForm.weight} onChange={e => setEditForm((f: any) => ({ ...f, weight: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updatePatient.isPending}>
              {updatePatient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
