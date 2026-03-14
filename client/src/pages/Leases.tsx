import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Pencil, Trash2, CalendarDays, User } from "lucide-react";
import type { Lease, Property } from "@shared/schema";

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const statusColor: Record<string, string> = {
  "פעיל": "bg-green-500/20 text-green-400 border-green-500/30",
  "הסתיים": "bg-muted/50 text-muted-foreground border-border",
  "עתידי": "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function LeaseForm({
  lease,
  properties,
  onSave,
  onClose,
}: {
  lease?: Lease;
  properties: Property[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      propertyId: lease?.propertyId?.toString() ?? "",
      tenantName: lease?.tenantName ?? "",
      tenantPhone: lease?.tenantPhone ?? "",
      tenantEmail: lease?.tenantEmail ?? "",
      tenantId: lease?.tenantId ?? "",
      startDate: lease?.startDate ?? "",
      endDate: lease?.endDate ?? "",
      monthlyRent: lease?.monthlyRent?.toString() ?? "",
      depositAmount: lease?.depositAmount?.toString() ?? "",
      paymentDayOfMonth: lease?.paymentDayOfMonth?.toString() ?? "1",
      status: lease?.status ?? "פעיל",
      notes: lease?.notes ?? "",
    },
  });

  const statusVal = watch("status");
  const propVal = watch("propertyId");

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>נכס *</Label>
          <Select value={propVal} onValueChange={v => setValue("propertyId", v)}>
            <SelectTrigger data-testid="select-property">
              <SelectValue placeholder="בחר נכס" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>שם שוכר *</Label>
          <Input {...register("tenantName", { required: true })} data-testid="input-tenant-name" />
        </div>

        <div>
          <Label>טלפון שוכר</Label>
          <Input {...register("tenantPhone")} data-testid="input-tenant-phone" />
        </div>
        <div>
          <Label>אימייל שוכר</Label>
          <Input {...register("tenantEmail")} type="email" data-testid="input-tenant-email" />
        </div>
        <div>
          <Label>ת.ז. שוכר</Label>
          <Input {...register("tenantId")} data-testid="input-tenant-id" />
        </div>
        <div>
          <Label>יום תשלום בחודש</Label>
          <Input {...register("paymentDayOfMonth")} type="number" min="1" max="28" data-testid="input-payment-day" />
        </div>

        <div>
          <Label>תאריך תחילה *</Label>
          <Input {...register("startDate", { required: true })} type="date" data-testid="input-start-date" />
        </div>
        <div>
          <Label>תאריך סיום *</Label>
          <Input {...register("endDate", { required: true })} type="date" data-testid="input-end-date" />
        </div>

        <div>
          <Label>שכירה חודשית (₪) *</Label>
          <Input {...register("monthlyRent", { required: true })} type="number" data-testid="input-monthly-rent" />
        </div>
        <div>
          <Label>פיקדון (₪)</Label>
          <Input {...register("depositAmount")} type="number" data-testid="input-deposit" />
        </div>

        <div className="col-span-2">
          <Label>סטאטוס</Label>
          <Select value={statusVal} onValueChange={v => setValue("status", v)}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="פעיל">פעיל</SelectItem>
              <SelectItem value="הסתיים">הסתיים</SelectItem>
              <SelectItem value="עתידי">עתידי</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>הערות</Label>
          <Input {...register("notes")} data-testid="input-notes" />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
        <Button type="submit" data-testid="btn-save-lease">{lease ? "עדכן" : "צור חוזה"}</Button>
      </div>
    </form>
  );
}

export default function Leases() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);

  const { data: leases = [], isLoading } = useQuery<Lease[]>({ queryKey: ["/api/leases"] });
  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["/api/properties"] });

  const propMap = new Map(properties.map(p => [p.id, p]));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leases", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leases"] }); setOpen(false); toast({ title: "חוזה נוצר בהצלחה" }); },
    onError: () => toast({ title: "שגיאה ביצירת חוזה", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/leases/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leases"] }); setEditing(null); toast({ title: "חוזה עודכן" }); },
    onError: () => toast({ title: "שגיאה בעדכון", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/leases/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/leases"] }); toast({ title: "חוזה נמחק" }); },
    onError: () => toast({ title: "שגיאה במחיקה", variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const activeLeases = leases.filter(l => l.status === "פעיל");
  const monthlyTotal = activeLeases.reduce((s, l) => s + l.monthlyRent, 0);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">חוזי שכירות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            מקור הנתונים לחישוב הכנסות שכירות בדוחות
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="btn-new-lease">
              <Plus className="h-4 w-4 ml-1" />
              חוזה חדש
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>חוזה שכירות חדש</DialogTitle>
            </DialogHeader>
            <LeaseForm properties={properties} onSave={handleSave} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "חוזים פעילים", value: activeLeases.length.toString(), sub: "מחייבי שכירות" },
          { label: "שכירה חודשית כוללת", value: fmt(monthlyTotal), sub: "מחוזים פעילים" },
          { label: "שכירה שנתית צפויה", value: fmt(monthlyTotal * 12), sub: "×12 חודשים" },
        ].map(({ label, value, sub }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold text-foreground">{value}</p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען...</div>
      ) : leases.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>אין חוזי שכירות. לחץ "חוזה חדש" להוספה.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leases.map(l => {
            const prop = propMap.get(l.propertyId);
            return (
              <Card key={l.id} className="bg-card border-border" data-testid={`lease-card-${l.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{prop?.name ?? `נכס #${l.propertyId}`}</span>
                          <Badge className={`text-xs border ${statusColor[l.status] ?? ""}`}>{l.status}</Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <User className="h-3 w-3" />
                          <span>{l.tenantName}</span>
                          {l.tenantPhone && <span>· {l.tenantPhone}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <CalendarDays className="h-3 w-3" />
                          <span>{l.startDate} – {l.endDate}</span>
                          <span>· יום תשלום: {l.paymentDayOfMonth}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-base font-bold text-primary">{fmt(l.monthlyRent)}</p>
                      <p className="text-xs text-muted-foreground">לחודש</p>
                      {l.depositAmount && (
                        <p className="text-xs text-muted-foreground mt-0.5">פיקדון: {fmt(l.depositAmount)}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
                {/* Actions */}
                <div className="flex gap-1 px-4 pb-3 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(l)}
                    data-testid={`btn-edit-lease-${l.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(l.id)}
                    data-testid={`btn-delete-lease-${l.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת חוזה</DialogTitle>
          </DialogHeader>
          {editing && (
            <LeaseForm
              lease={editing}
              properties={properties}
              onSave={handleSave}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
