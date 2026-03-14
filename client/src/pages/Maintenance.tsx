import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wrench, Pencil, Trash2, AlertCircle } from "lucide-react";
import type { Maintenance as MaintenanceType, Property } from "@shared/schema";

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const statusColor: Record<string, string> = {
  "פתוח": "bg-red-500/20 text-red-400 border-red-500/30",
  "בטיפול": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "סגור": "bg-green-500/20 text-green-400 border-green-500/30",
};

const CATEGORIES = ["אינסטלציה", "חשמל", "מזגן", "בנייה", "ריהוט", "אחר"];
const STATUSES = ["פתוח", "בטיפול", "סגור"];

function MaintenanceForm({
  item,
  properties,
  onSave,
  onClose,
}: {
  item?: MaintenanceType;
  properties: Property[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      propertyId: item?.propertyId?.toString() ?? "",
      title: item?.title ?? "",
      description: item?.description ?? "",
      category: item?.category ?? "אחר",
      status: item?.status ?? "פתוח",
      reportedDate: item?.reportedDate ?? new Date().toISOString().split("T")[0],
      resolvedDate: item?.resolvedDate ?? "",
      cost: item?.cost?.toString() ?? "",
      paidBy: item?.paidBy ?? "בעלים",
      contractor: item?.contractor ?? "",
      notes: item?.notes ?? "",
    },
  });

  const statusVal = watch("status");
  const catVal = watch("category");
  const propVal = watch("propertyId");
  const paidByVal = watch("paidBy");

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
              {properties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>כותרת *</Label>
          <Input {...register("title", { required: true })} placeholder="תיאור קצר של התקלה" data-testid="input-title" />
        </div>
        <div className="col-span-2">
          <Label>תיאור מפורט</Label>
          <Input {...register("description")} data-testid="input-description" />
        </div>

        <div>
          <Label>קטגוריה</Label>
          <Select value={catVal} onValueChange={v => setValue("category", v)}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>סטאטוס</Label>
          <Select value={statusVal} onValueChange={v => setValue("status", v)}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>תאריך דיווח</Label>
          <Input {...register("reportedDate")} type="date" data-testid="input-reported-date" />
        </div>
        <div>
          <Label>תאריך סגירה</Label>
          <Input {...register("resolvedDate")} type="date" data-testid="input-resolved-date" />
        </div>

        <div>
          <Label>עלות (₪)</Label>
          <Input {...register("cost")} type="number" step="0.01" data-testid="input-cost" />
        </div>
        <div>
          <Label>משלם</Label>
          <Select value={paidByVal} onValueChange={v => setValue("paidBy", v)}>
            <SelectTrigger data-testid="select-paid-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="בעלים">בעלים</SelectItem>
              <SelectItem value="שוכר">שוכר</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label>קבלן</Label>
          <Input {...register("contractor")} placeholder="שם הקבלן / בעל המקצוע" data-testid="input-contractor" />
        </div>
        <div className="col-span-2">
          <Label>הערות</Label>
          <Input {...register("notes")} data-testid="input-notes" />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
        <Button type="submit" data-testid="btn-save-maintenance">{item ? "עדכן" : "צור קריאה"}</Button>
      </div>
    </form>
  );
}

export default function Maintenance() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceType | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery<MaintenanceType[]>({ queryKey: ["/api/maintenance"] });
  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["/api/properties"] });

  const propMap = new Map(properties.map(p => [p.id, p]));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/maintenance", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); setOpen(false); toast({ title: "קריאה נוצרה" }); },
    onError: () => toast({ title: "שגיאה ביצירה", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/maintenance/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); setEditing(null); toast({ title: "קריאה עודכנה" }); },
    onError: () => toast({ title: "שגיאה בעדכון", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/maintenance/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); toast({ title: "קריאה נמחקה" }); },
    onError: () => toast({ title: "שגיאה במחיקה", variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const openItems = items.filter(i => i.status === "פתוח");
  const inProgressItems = items.filter(i => i.status === "בטיפול");
  const totalCost = items
    .filter(i => i.paidBy === "בעלים" && i.cost)
    .reduce((s, i) => s + (i.cost ?? 0), 0);

  const filtered = filterStatus === "all" ? items : items.filter(i => i.status === filterStatus);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">תחזוקה ותקלות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            עלויות תחזוקה שמשלם הבעלים מחושבות בדוחות ההוצאות
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="btn-new-maintenance">
              <Plus className="h-4 w-4 ml-1" />
              קריאה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>קריאת תחזוקה / תקלה חדשה</DialogTitle>
            </DialogHeader>
            <MaintenanceForm properties={properties} onSave={handleSave} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "קריאות פתוחות", value: openItems.length.toString(), cls: openItems.length > 0 ? "text-red-400" : "text-green-400" },
          { label: "בטיפול", value: inProgressItems.length.toString(), cls: "text-yellow-400" },
          { label: "סגורות", value: items.filter(i => i.status === "סגור").length.toString(), cls: "text-green-400" },
          { label: "עלות כוללת (בעלים)", value: new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(totalCost), cls: "text-red-400" },
        ].map(({ label, value, cls }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold ${cls}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">הכל ({items.length})</TabsTrigger>
          <TabsTrigger value="פתוח">פתוח ({openItems.length})</TabsTrigger>
          <TabsTrigger value="בטיפול">בטיפול ({inProgressItems.length})</TabsTrigger>
          <TabsTrigger value="סגור">סגור ({items.filter(i => i.status === "סגור").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={filterStatus} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">טוען...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>אין קריאות {filterStatus !== "all" ? filterStatus : ""}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(item => {
                const prop = propMap.get(item.propertyId);
                return (
                  <Card key={item.id} className="bg-card border-border" data-testid={`maintenance-card-${item.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.status === "פתוח" ? "bg-red-500/20" :
                            item.status === "בטיפול" ? "bg-yellow-500/20" : "bg-green-500/20"
                          }`}>
                            {item.status === "פתוח" ? (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            ) : (
                              <Wrench className={`h-4 w-4 ${item.status === "בטיפול" ? "text-yellow-400" : "text-green-400"}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground">{item.title}</span>
                              <Badge className={`text-xs border ${statusColor[item.status] ?? ""}`}>{item.status}</Badge>
                              <Badge variant="outline" className="text-xs">{item.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {prop?.name ?? `נכס #${item.propertyId}`}
                              {item.description && ` · ${item.description}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              דיווח: {item.reportedDate}
                              {item.resolvedDate && ` · סגירה: ${item.resolvedDate}`}
                              {item.contractor && ` · קבלן: ${item.contractor}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          {item.cost ? (
                            <>
                              <p className="text-base font-bold text-red-400">{fmt(item.cost)}</p>
                              <p className="text-xs text-muted-foreground">משלם: {item.paidBy}</p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">ללא עלות</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    <div className="flex gap-1 px-4 pb-3 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(item)}
                        data-testid={`btn-edit-maintenance-${item.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`btn-delete-maintenance-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת קריאת תחזוקה</DialogTitle>
          </DialogHeader>
          {editing && (
            <MaintenanceForm
              item={editing}
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
