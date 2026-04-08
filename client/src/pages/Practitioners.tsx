import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star, User, Phone, Mail, MapPin, Globe, Award, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PractitionerForm {
  name: string;
  title: string;
  qualifications: string;
  clinic: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  isDefault: boolean;
}

const emptyForm: PractitionerForm = {
  name: "",
  title: "",
  qualifications: "",
  clinic: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  isDefault: false,
};

export default function Practitioners() {
  const { data: practitioners, isLoading } = trpc.practitioner.list.useQuery();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PractitionerForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = trpc.practitioner.create.useMutation({
    onSuccess: () => {
      utils.practitioner.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Practitioner added");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.practitioner.update.useMutation({
    onSuccess: () => {
      utils.practitioner.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Practitioner updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.practitioner.delete.useMutation({
    onSuccess: () => {
      utils.practitioner.list.invalidate();
      setDeleteId(null);
      toast.success("Practitioner removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.practitioner.setDefault.useMutation({
    onSuccess: () => {
      utils.practitioner.list.invalidate();
      toast.success("Default practitioner updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      title: p.title || "",
      qualifications: p.qualifications || "",
      clinic: p.clinic || "",
      phone: p.phone || "",
      email: p.email || "",
      website: p.website || "",
      address: p.address || "",
      isDefault: p.isDefault || false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a365d]">Practitioners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage practitioner profiles. The default practitioner's details appear on exported reports.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#2874A6] hover:bg-[#1a5a8a]">
          <Plus className="h-4 w-4 mr-2" /> Add Practitioner
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !practitioners || practitioners.length === 0 ? (
        <Card className="border-dashed border-[#2874A6]/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-14 w-14 rounded-2xl bg-[#2874A6]/10 flex items-center justify-center mb-4">
              <User className="h-7 w-7 text-[#2874A6]" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No practitioners yet</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center max-w-md">
              Add your team's practitioners so their contact details appear on exported reports.
            </p>
            <Button onClick={openCreate} className="bg-[#2874A6] hover:bg-[#1a5a8a]">
              <Plus className="h-4 w-4 mr-2" /> Add First Practitioner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {practitioners.map((p) => (
            <Card key={p.id} className={`transition-all ${p.isDefault ? "ring-2 ring-[#2874A6]/30 shadow-md" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-[#2874A6]/10 flex items-center justify-center shrink-0">
                      <User className="h-6 w-6 text-[#2874A6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#1a365d]">{p.name}</h3>
                        {p.isDefault && (
                          <Badge className="bg-[#2874A6]/10 text-[#2874A6] hover:bg-[#2874A6]/10 text-xs">
                            <Star className="h-3 w-3 mr-1 fill-current" /> Default
                          </Badge>
                        )}
                      </div>
                      {p.title && <p className="text-sm text-muted-foreground">{p.title}</p>}
                      {p.qualifications && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Award className="h-3.5 w-3.5 text-[#D68910]" />
                          <span className="text-xs text-muted-foreground">{p.qualifications}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {p.clinic && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {p.clinic}
                          </span>
                        )}
                        {p.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </span>
                        )}
                        {p.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {p.email}
                          </span>
                        )}
                        {p.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {p.website}
                          </span>
                        )}
                      </div>
                      {p.address && <p className="text-xs text-muted-foreground mt-1">{p.address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!p.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-[#2874A6]"
                        onClick={() => setDefaultMutation.mutate({ id: p.id })}
                        disabled={setDefaultMutation.isPending}
                      >
                        <Star className="h-3.5 w-3.5 mr-1" /> Set Default
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Practitioner" : "Add Practitioner"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Dr. Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title / Role</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Physiotherapist"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qualifications">Qualifications</Label>
                <Input
                  id="qualifications"
                  value={form.qualifications}
                  onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                  placeholder="e.g. BSc, MSc, FACP"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clinic">Clinic / Organisation</Label>
              <Input
                id="clinic"
                value={form.clinic}
                onChange={(e) => setForm({ ...form, clinic: e.target.value })}
                placeholder="e.g. Total Health - Hong Kong Sports Clinic"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +852 1234 5678"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. jane@clinic.com"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="e.g. www.totalhealthhk.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                placeholder="Clinic address..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#2874A6] hover:bg-[#1a5a8a]">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Add Practitioner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove practitioner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this practitioner profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
