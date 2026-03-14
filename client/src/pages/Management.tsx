import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Property, Owner, PropertyWithOwners, PropertyOwnerWithDetails } from "@shared/schema";
import {
  Building2, Users, Plus, Trash2, Edit2, Check, X,
  Phone, Mail, CreditCard, Percent, CalendarDays, ChevronDown, ChevronUp,
  User, StickyNote, MapPin, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

const PROPERTY_TYPES = ["דירת מגורים", "משרד", "וילה", "חנות", "מחסן", "קרקע", "בניין מגורים", "אחר"];

// ─── Property Form ─────────────────────────────────────────────────────────
type PropertyFormData = {
  name: string; address: string; city: string; type: string; code: string; notes: string;
};
const emptyProperty = (): PropertyFormData => ({ name: "", address: "", city: "", type: "דירת מגורים", code: "", notes: "" });

// ─── Owner Form ────────────────────────────────────────────────────────────
type OwnerFormData = {
  name: string; phone: string; email: string; idNumber: string; bankAccount: string; code: string; notes: string;
};
const emptyOwner = (): OwnerFormData => ({ name: "", phone: "", email: "", idNumber: "", bankAccount: "", code: "", notes: "" });

// ─── Assignment Form ───────────────────────────────────────────────────────
type AssignFormData = {
  ownerId: string; ownershipPercent: string; startDate: string; notes: string;
};
const emptyAssign = (): AssignFormData => ({ ownerId: "", ownershipPercent: "100", startDate: "", notes: "" });

export default function Management() {
  const { toast } = useToast();

  // ─── State ───────────────────────────────────────────────────────────────
  const [propDialog, setPropDialog] = useState(false);
  const [ownerDialog, setOwnerDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState<number | null>(null); // propertyId
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [propForm, setPropForm] = useState<PropertyFormData>(emptyProperty());
  const [ownerForm, setOwnerForm] = useState<OwnerFormData>(emptyOwner());
  const [assignForm, setAssignForm] = useState<AssignFormData>(emptyAssign());
  const [expandedProp, setExpandedProp] = useState<number | null>(null);
  const [newOwnerInAssign, setNewOwnerInAssign] = useState(false);

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: propertiesWithOwners = [] } = useQuery<PropertyWithOwners[]>({
    queryKey: ["/api/properties/with-owners"],
  });
  const { data: owners = [] } = useQuery<Owner[]>({
    queryKey: ["/api/owners"],
  });
  const { data: propertyOwners = [] } = useQuery<{ propertyId: number; ownerId: number; ownershipPercent: number }[]>({
    queryKey: ["/api/property-owners"],
  });

  // ─── Mutations — Properties ───────────────────────────────────────────────
  const createProp = useMutation({
    mutationFn: (data: PropertyFormData) => apiRequest("POST", "/api/properties", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      setPropDialog(false); setPropForm(emptyProperty()); setEditingProp(null);
      toast({ title: "הנכס נוסף בהצלחה" });
    },
    onError: () => toast({ title: "שגיאה ביצירת הנכס", variant: "destructive" }),
  });

  const updateProp = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PropertyFormData> }) =>
      apiRequest("PATCH", `/api/properties/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      setPropDialog(false); setPropForm(emptyProperty()); setEditingProp(null);
      toast({ title: "הנכס עודכן" });
    },
  });

  const deleteProp = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      toast({ title: "הנכס נמחק" });
    },
  });

  // ─── Mutations — Owners ────────────────────────────────────────────────────
  const createOwner = useMutation({
    mutationFn: (data: OwnerFormData) => apiRequest("POST", "/api/owners", data),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      setOwnerDialog(false); setOwnerForm(emptyOwner()); setEditingOwner(null);
      toast({ title: "הבעלים נוסף בהצלחה" });
      // If we're in the assign flow, auto-select the new owner
      const newOwner = await res.json();
      if (newOwnerInAssign && newOwner?.id) {
        setAssignForm(f => ({ ...f, ownerId: String(newOwner.id) }));
        setNewOwnerInAssign(false);
      }
    },
    onError: () => toast({ title: "שגיאה ביצירת הבעלים", variant: "destructive" }),
  });

  const updateOwner = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OwnerFormData> }) =>
      apiRequest("PATCH", `/api/owners/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      setOwnerDialog(false); setOwnerForm(emptyOwner()); setEditingOwner(null);
      toast({ title: "הבעלים עודכן" });
    },
  });

  const deleteOwner = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/owners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      toast({ title: "הבעלים נמחק" });
    },
  });

  // ─── Mutations — Assignments ───────────────────────────────────────────────
  const createAssign = useMutation({
    mutationFn: (data: { propertyId: number; ownerId: number; ownershipPercent: number; startDate: string; notes: string }) =>
      apiRequest("POST", "/api/property-owners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/property-owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      setAssignDialog(null); setAssignForm(emptyAssign());
      toast({ title: "הבעלים שויך לנכס" });
    },
    onError: () => toast({ title: "שגיאה בשיוך הבעלים", variant: "destructive" }),
  });

  const deleteAssign = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/property-owners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/property-owners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-owners"] });
      toast({ title: "השיוך הוסר" });
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const openAddProp = () => { setEditingProp(null); setPropForm(emptyProperty()); setPropDialog(true); };
  const openEditProp = (p: Property) => {
    setEditingProp(p);
    setPropForm({ name: p.name, address: p.address, city: p.city, type: p.type, code: p.code, notes: p.notes ?? "" });
    setPropDialog(true);
  };
  const openAddOwner = (fromAssign = false) => {
    setNewOwnerInAssign(fromAssign);
    setEditingOwner(null); setOwnerForm(emptyOwner()); setOwnerDialog(true);
  };
  const openEditOwner = (o: Owner) => {
    setEditingOwner(o);
    setOwnerForm({ name: o.name, phone: o.phone ?? "", email: o.email ?? "", idNumber: o.idNumber ?? "", bankAccount: o.bankAccount ?? "", code: o.code, notes: o.notes ?? "" });
    setOwnerDialog(true);
  };

  const submitProp = () => {
    if (!propForm.name || !propForm.address || !propForm.city) {
      toast({ title: "נא למלא שם, כתובת ועיר", variant: "destructive" }); return;
    }
    if (editingProp) updateProp.mutate({ id: editingProp.id, data: propForm });
    else createProp.mutate(propForm);
  };

  const submitOwner = () => {
    if (!ownerForm.name) { toast({ title: "נא להזין שם בעלים", variant: "destructive" }); return; }
    if (editingOwner) updateOwner.mutate({ id: editingOwner.id, data: ownerForm });
    else createOwner.mutate(ownerForm);
  };

  const submitAssign = () => {
    if (!assignDialog || !assignForm.ownerId) {
      toast({ title: "נא לבחור בעלים", variant: "destructive" }); return;
    }
    const pct = parseFloat(assignForm.ownershipPercent);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: "אחוז בעלות חייב להיות בין 1 ל-100", variant: "destructive" }); return;
    }
    // Check total won't exceed 100
    const prop = propertiesWithOwners.find(p => p.id === assignDialog);
    const currentTotal = (prop?.owners ?? []).reduce((s, o) => s + o.ownershipPercent, 0);
    if (currentTotal + pct > 100.01) {
      toast({ title: `סה"כ אחוזי בעלות יעברו 100% (כרגע ${currentTotal}%)`, variant: "destructive" }); return;
    }
    createAssign.mutate({
      propertyId: assignDialog,
      ownerId: parseInt(assignForm.ownerId),
      ownershipPercent: pct,
      startDate: assignForm.startDate,
      notes: assignForm.notes,
    });
  };

  // Owners already assigned to a property (for filtering select)
  const assignedOwnerIds = (propertyId: number) =>
    (propertiesWithOwners.find(p => p.id === propertyId)?.owners ?? []).map(o => o.ownerId);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">ניהול נכסים ובעלים</h1>
          <p className="text-xs text-muted-foreground mt-0.5">הגדרת נכסים, בעלים ושיוכים</p>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="properties" dir="rtl">
          <TabsList className="mb-6">
            <TabsTrigger value="properties" className="gap-2">
              <Building2 className="h-4 w-4" />
              נכסים ({propertiesWithOwners.length})
            </TabsTrigger>
            <TabsTrigger value="owners" className="gap-2">
              <Users className="h-4 w-4" />
              בעלים ({owners.length})
            </TabsTrigger>
          </TabsList>

          {/* ── PROPERTIES TAB ─────────────────────────────────────────────── */}
          <TabsContent value="properties">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">רשימת נכסים</h2>
              <Button onClick={openAddProp} size="sm" className="gap-1.5" data-testid="button-add-property">
                <Plus className="h-4 w-4" /> נכס חדש
              </Button>
            </div>

            <div className="space-y-3">
              {propertiesWithOwners.map(prop => {
                const totalPct = prop.owners.reduce((s, o) => s + o.ownershipPercent, 0);
                const isExpanded = expandedProp === prop.id;
                return (
                  <div key={prop.id} className="bg-card border border-border rounded-lg overflow-hidden" data-testid={`card-property-${prop.id}`}>
                    {/* Property row */}
                    <div className="flex items-center px-4 py-3 gap-3">
                      <button
                        onClick={() => setExpandedProp(isExpanded ? null : prop.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      <div className="w-16 text-xs text-muted-foreground font-mono">{prop.code}</div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{prop.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {prop.address}, {prop.city}
                        </div>
                      </div>

                      <Badge variant="outline" className="text-xs shrink-0">{prop.type}</Badge>

                      <div className="flex items-center gap-1 shrink-0">
                        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${totalPct === 100 ? "bg-green-500/15 text-green-400" : totalPct > 0 ? "bg-yellow-500/15 text-yellow-400" : "bg-muted text-muted-foreground"}`}>
                          <Percent className="h-3 w-3" />
                          {totalPct}% שויך
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setAssignDialog(prop.id); setAssignForm(emptyAssign()); }}
                          title="שייך בעלים"
                          data-testid={`button-assign-${prop.id}`}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProp(prop)} data-testid={`button-edit-property-${prop.id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteProp.mutate(prop.id)}
                          data-testid={`button-delete-property-${prop.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded owners list */}
                    {isExpanded && (
                      <div className="border-t border-border bg-card/50 px-4 py-3">
                        {prop.owners.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">אין בעלים משויכים לנכס זה</p>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground mb-2 font-medium">בעלים משויכים:</div>
                            {prop.owners.map(o => (
                              <div key={o.id} className="flex items-center gap-3 bg-background/50 rounded px-3 py-2" data-testid={`row-assignment-${o.id}`}>
                                <div className="flex-1 text-sm font-medium">{o.ownerName}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  {o.ownerPhone && <><Phone className="h-3 w-3" />{o.ownerPhone}</>}
                                </div>
                                <div className="flex items-center gap-1 text-primary text-sm font-semibold">
                                  <Percent className="h-3 w-3" />{o.ownershipPercent}%
                                </div>
                                {o.startDate && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />{o.startDate}
                                  </div>
                                )}
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => deleteAssign.mutate(o.id)}
                                  data-testid={`button-remove-assignment-${o.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="outline" size="sm" className="mt-3 gap-1 text-xs h-7"
                          onClick={() => { setAssignDialog(prop.id); setAssignForm(emptyAssign()); }}
                        >
                          <Plus className="h-3 w-3" /> הוסף בעלים לנכס
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {propertiesWithOwners.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">אין נכסים במערכת</p>
                  <Button onClick={openAddProp} variant="outline" size="sm" className="mt-3 gap-1">
                    <Plus className="h-3.5 w-3.5" /> הוסף נכס ראשון
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── OWNERS TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="owners">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">רשימת בעלים</h2>
              <Button onClick={() => openAddOwner(false)} size="sm" className="gap-1.5" data-testid="button-add-owner">
                <Plus className="h-4 w-4" /> בעלים חדש
              </Button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-20">קוד</TableHead>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">מייל</TableHead>
                    <TableHead className="text-right">ת"ז</TableHead>
                    <TableHead className="text-right">נכסים</TableHead>
                    <TableHead className="text-right w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owners.map(owner => {
                    const ownerProps = propertiesWithOwners.filter(p => p.owners.some(o => o.ownerId === owner.id));
                    return (
                      <TableRow key={owner.id} data-testid={`row-owner-${owner.id}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{owner.code}</TableCell>
                        <TableCell className="font-medium">{owner.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{owner.phone ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{owner.email ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{owner.idNumber ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ownerProps.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : ownerProps.map(p => (
                              <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditOwner(owner)} data-testid={`button-edit-owner-${owner.id}`}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteOwner.mutate(owner.id)}
                              data-testid={`button-delete-owner-${owner.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {owners.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">אין בעלים במערכת</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Dialog: Add/Edit Property ──────────────────────────────────────── */}
      <Dialog open={propDialog} onOpenChange={setPropDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingProp ? "עריכת נכס" : "נכס חדש"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>שם הנכס *</Label>
                <Input
                  placeholder="לדוגמה: דירת הירקון"
                  value={propForm.name}
                  onChange={e => setPropForm(f => ({ ...f, name: e.target.value }))}
                  data-testid="input-property-name"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>כתובת *</Label>
                <Input
                  placeholder="רחוב ומספר"
                  value={propForm.address}
                  onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))}
                  data-testid="input-property-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label>עיר *</Label>
                <Input
                  placeholder="עיר"
                  value={propForm.city}
                  onChange={e => setPropForm(f => ({ ...f, city: e.target.value }))}
                  data-testid="input-property-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label>סוג נכס</Label>
                <Select value={propForm.type} onValueChange={v => setPropForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-property-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>קוד נכס</Label>
                <Input
                  placeholder="אוטומטי"
                  value={propForm.code}
                  onChange={e => setPropForm(f => ({ ...f, code: e.target.value }))}
                  data-testid="input-property-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label>הערות</Label>
                <Input
                  placeholder="הערות אופציונליות"
                  value={propForm.notes}
                  onChange={e => setPropForm(f => ({ ...f, notes: e.target.value }))}
                  data-testid="input-property-notes"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setPropDialog(false)}>ביטול</Button>
              <Button onClick={submitProp} disabled={createProp.isPending || updateProp.isPending} data-testid="button-submit-property">
                <Check className="h-4 w-4 ml-1" />
                {editingProp ? "עדכן נכס" : "צור נכס"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Add/Edit Owner ─────────────────────────────────────────── */}
      <Dialog open={ownerDialog} onOpenChange={setOwnerDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {editingOwner ? "עריכת בעלים" : "בעלים חדש"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>שם מלא *</Label>
                <Input
                  placeholder="שם הבעלים"
                  value={ownerForm.name}
                  onChange={e => setOwnerForm(f => ({ ...f, name: e.target.value }))}
                  data-testid="input-owner-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>טלפון</Label>
                <Input
                  placeholder="050-0000000"
                  value={ownerForm.phone}
                  onChange={e => setOwnerForm(f => ({ ...f, phone: e.target.value }))}
                  data-testid="input-owner-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label>מייל</Label>
                <Input
                  placeholder="email@example.com"
                  value={ownerForm.email}
                  onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="input-owner-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label>מספר ת"ז</Label>
                <Input
                  placeholder="9 ספרות"
                  value={ownerForm.idNumber}
                  onChange={e => setOwnerForm(f => ({ ...f, idNumber: e.target.value }))}
                  data-testid="input-owner-id"
                />
              </div>
              <div className="space-y-1.5">
                <Label>חשבון בנק</Label>
                <Input
                  placeholder="סניף-חשבון"
                  value={ownerForm.bankAccount}
                  onChange={e => setOwnerForm(f => ({ ...f, bankAccount: e.target.value }))}
                  data-testid="input-owner-bank"
                />
              </div>
              <div className="space-y-1.5">
                <Label>קוד בעלים</Label>
                <Input
                  placeholder="אוטומטי"
                  value={ownerForm.code}
                  onChange={e => setOwnerForm(f => ({ ...f, code: e.target.value }))}
                  data-testid="input-owner-code"
                />
              </div>
              <div className="space-y-1.5">
                <Label>הערות</Label>
                <Input
                  placeholder="הערות אופציונליות"
                  value={ownerForm.notes}
                  onChange={e => setOwnerForm(f => ({ ...f, notes: e.target.value }))}
                  data-testid="input-owner-notes"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setOwnerDialog(false)}>ביטול</Button>
              <Button onClick={submitOwner} disabled={createOwner.isPending || updateOwner.isPending} data-testid="button-submit-owner">
                <Check className="h-4 w-4 ml-1" />
                {editingOwner ? "עדכן בעלים" : "צור בעלים"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Assign Owner to Property ──────────────────────────────── */}
      <Dialog open={assignDialog !== null} onOpenChange={(open) => { if (!open) setAssignDialog(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              שיוך בעלים לנכס
            </DialogTitle>
          </DialogHeader>

          {assignDialog && (() => {
            const prop = propertiesWithOwners.find(p => p.id === assignDialog);
            const totalPct = (prop?.owners ?? []).reduce((s, o) => s + o.ownershipPercent, 0);
            const remaining = 100 - totalPct;
            const alreadyAssigned = assignedOwnerIds(assignDialog);
            const availableOwners = owners.filter(o => !alreadyAssigned.includes(o.id));

            return (
              <div className="space-y-4 pt-2">
                {prop && (
                  <div className="bg-muted/30 rounded-lg px-4 py-3 text-sm">
                    <div className="font-medium">{prop.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{prop.address}, {prop.city}</div>
                    <div className={`text-xs mt-2 font-medium ${remaining < 0 ? "text-destructive" : remaining === 0 ? "text-green-400" : "text-yellow-400"}`}>
                      נותר לשיוך: {remaining.toFixed(0)}%
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>בחר בעלים *</Label>
                    <Button
                      variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary"
                      onClick={() => openAddOwner(true)}
                      data-testid="button-add-owner-from-assign"
                    >
                      <Plus className="h-3 w-3" /> בעלים חדש
                    </Button>
                  </div>
                  {availableOwners.length === 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded p-3 text-center">
                      כל הבעלים כבר משויכים לנכס זה
                    </div>
                  ) : (
                    <Select value={assignForm.ownerId} onValueChange={v => setAssignForm(f => ({ ...f, ownerId: v }))}>
                      <SelectTrigger data-testid="select-assign-owner">
                        <SelectValue placeholder="בחר בעלים..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOwners.map(o => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            <div className="flex items-center gap-2">
                              <span>{o.name}</span>
                              {o.phone && <span className="text-muted-foreground text-xs">{o.phone}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>אחוז בעלות *</Label>
                    <div className="relative">
                      <Input
                        type="number" min="1" max="100" step="0.1"
                        value={assignForm.ownershipPercent}
                        onChange={e => setAssignForm(f => ({ ...f, ownershipPercent: e.target.value }))}
                        className="pl-8"
                        data-testid="input-ownership-percent"
                      />
                      <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {remaining > 0 && (
                      <button
                        onClick={() => setAssignForm(f => ({ ...f, ownershipPercent: String(remaining) }))}
                        className="text-xs text-primary hover:underline"
                      >
                        מלא {remaining}% שנותר
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>תאריך תחילה</Label>
                    <Input
                      type="date"
                      value={assignForm.startDate}
                      onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))}
                      data-testid="input-assign-date"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>הערות</Label>
                  <Input
                    placeholder="הערות לשיוך זה"
                    value={assignForm.notes}
                    onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                    data-testid="input-assign-notes"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" onClick={() => setAssignDialog(null)}>ביטול</Button>
                  <Button
                    onClick={submitAssign}
                    disabled={createAssign.isPending || availableOwners.length === 0}
                    data-testid="button-submit-assign"
                  >
                    <Check className="h-4 w-4 ml-1" />
                    שייך בעלים
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <PerplexityAttribution />
    </div>
  );
}
