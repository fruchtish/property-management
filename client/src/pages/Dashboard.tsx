import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Transaction, Property } from "@shared/schema";
import {
  Building2, TrendingUp, TrendingDown, Wallet, Plus, Trash2,
  FileText, Image, Upload, X, Eye, ChevronDown, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

// ─── Helpers ─────────────────────────────────────────────────────────────
const ILS = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const fmt = (n: number) => ILS.format(n);

const INCOME_CATEGORIES = ["שכירות", "פיקדון", "ביטחון", "ריבית", "אחר"];
const EXPENSE_CATEGORIES = [
  "ארנונה", "ועד בית", "חשמל", "מים", "גז", "ביטוח",
  "תיקון/תחזוקה", "עורך דין", "תיווך", "רואה חשבון", "ניהול נכס", "פרסום", "אחר"
];
const EXPENSE_TYPES = ["הוצאה ישירה", "הוצאה עקיפה", "תיקון/תחזוקה"];
const PAYMENT_STATUS = ["שולם", "ממתין", "חלקי"];
const COLLECTION_METHODS = ["העברה בנקאית", "מזומן", "שיק", "אפליקציה", "ניכוי משכירות"];

// ─── File Drop Zone ───────────────────────────────────────────────────────
function FileDropZone({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, [setFile]);

  return (
    <div
      className={`drop-zone p-6 text-center ${dragging ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      data-testid="file-drop-zone"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        data-testid="file-input"
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          {file.type.startsWith("image/") ? (
            <Image className="w-5 h-5 text-primary" />
          ) : (
            <FileText className="w-5 h-5 text-primary" />
          )}
          <span className="text-foreground font-medium">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFile(null); }}
            className="text-muted-foreground hover:text-destructive"
            data-testid="file-remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="w-8 h-8 mb-1 text-muted-foreground/60" />
          <p className="text-sm font-medium">לחץ לבחירת קובץ או גרור לכאן</p>
          <p className="text-xs text-muted-foreground/60">תמונות (JPG, PNG, GIF, WebP) ו-PDF עד 10MB</p>
        </div>
      )}
    </div>
  );
}

// ─── Transaction Form ─────────────────────────────────────────────────────
function TransactionForm({ onClose, properties }: { onClose: () => void; properties: Property[] }) {
  const { toast } = useToast();
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("שולם");
  const [expenseType, setExpenseType] = useState("");
  const [collectionMethod, setCollectionMethod] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("type", txType);
      fd.append("propertyId", propertyId);
      fd.append("date", date);
      fd.append("amount", amount);
      fd.append("category", category);
      fd.append("description", description);
      fd.append("paymentStatus", paymentStatus);
      fd.append("expenseType", expenseType);
      fd.append("collectionMethod", collectionMethod);
      if (file) fd.append("file", file);

      const res = await fetch("/api/transactions", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "שגיאה בשמירה");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "נשמר בהצלחה", description: `${txType === "income" ? "הכנסה" : "הוצאה"} נוספה למערכת` });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const isValid = propertyId && date && amount && parseFloat(amount) > 0 && category;

  return (
    <div className="space-y-4" data-testid="transaction-form">
      {/* Type Toggle */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">סוג הפעולה</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="btn-income"
            onClick={() => { setTxType("income"); setCategory(""); setExpenseType(""); }}
            className={`py-2.5 px-4 rounded-md text-sm font-medium transition-all border ${
              txType === "income"
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                : "border-border text-muted-foreground hover:border-emerald-500/40"
            }`}
          >
            הכנסה משכירות
          </button>
          <button
            type="button"
            data-testid="btn-expense"
            onClick={() => { setTxType("expense"); setCategory(""); }}
            className={`py-2.5 px-4 rounded-md text-sm font-medium transition-all border ${
              txType === "expense"
                ? "bg-red-500/20 border-red-500/60 text-red-400"
                : "border-border text-muted-foreground hover:border-red-500/40"
            }`}
          >
            הוצאה / תיקון
          </button>
        </div>
      </div>

      {/* Property + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">מזהה נכס *</Label>
          <Select value={propertyId} onValueChange={setPropertyId} data-testid="select-property">
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="בחר נכס" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={String(p.id)} data-testid={`property-option-${p.id}`}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">תאריך *</Label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-input border-border"
            data-testid="input-date"
          />
        </div>
      </div>

      {/* Amount + Description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">סכום (₪) *</Label>
          <Input
            type="number"
            min="0"
            placeholder="5000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-input border-border"
            data-testid="input-amount"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">תיאור קצר</Label>
          <Input
            placeholder="מטבח"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-input border-border"
            data-testid="input-description"
          />
        </div>
      </div>

      {/* Category + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">קטגוריה *</Label>
          <Select value={category} onValueChange={setCategory} data-testid="select-category">
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="בחר" />
            </SelectTrigger>
            <SelectContent>
              {(txType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">סטטוס תשלום</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus} data-testid="select-status">
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expense Type (only for expense) + Collection Method */}
      <div className="grid grid-cols-2 gap-3">
        {txType === "expense" && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">סוג הוצאה</Label>
            <Select value={expenseType} onValueChange={setExpenseType} data-testid="select-expense-type">
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="בחר" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className={txType === "income" ? "col-span-2" : ""}>
          <Label className="text-xs text-muted-foreground mb-1.5 block">אופן גבייה מבעלים</Label>
          <Select value={collectionMethod} onValueChange={setCollectionMethod} data-testid="select-collection">
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="בחר" />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* File Upload */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">קובץ מצורף (חשבונית, קבלה, תמונה)</Label>
        <FileDropZone file={file} setFile={setFile} />
      </div>

      {/* Error from previous attempt */}
      {mutation.isError && (
        <p className="text-destructive text-sm">
          שגיאה: {(mutation.error as Error).message}
        </p>
      )}

      {/* Submit */}
      <Button
        onClick={() => mutation.mutate()}
        disabled={!isValid || mutation.isPending}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        data-testid="btn-submit"
      >
        {mutation.isPending ? "שומר..." : "שמור ועדכן מערכת"}
      </Button>
    </div>
  );
}

// ─── File Viewer ──────────────────────────────────────────────────────────
function FileViewer({ tx }: { tx: Transaction }) {
  if (!tx.fileUrl) return null;
  const isPdf = tx.fileName?.toLowerCase().endsWith(".pdf");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-primary" data-testid={`btn-view-file-${tx.id}`}>
          <Eye className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">{tx.fileName}</DialogTitle>
        </DialogHeader>
        {isPdf ? (
          <iframe src={tx.fileUrl!} className="w-full h-[70vh] rounded-md" title={tx.fileName ?? "file"} />
        ) : (
          <img src={tx.fileUrl!} alt={tx.fileName ?? "file"} className="max-h-[70vh] object-contain mx-auto rounded-md" />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, variant }: {
  label: string; value: string; icon: any; variant: "income" | "expense" | "profit" | "neutral";
}) {
  const cls = {
    income: "stat-card-income",
    expense: "stat-card-expense",
    profit: "stat-card-profit",
    neutral: "",
  }[variant];

  const iconColor = {
    income: "text-emerald-400",
    expense: "text-red-400",
    profit: "text-primary",
    neutral: "text-muted-foreground",
  }[variant];

  return (
    <div className={`rounded-xl border p-4 ${cls}`} data-testid={`stat-${variant}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className={`text-xl font-bold font-mono ${iconColor}`}>{value}</p>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────
export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "נמחק", description: "הרשומה הוסרה מהמערכת" });
    },
  });

  // Computed stats
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const profit = income - expense;

  // Filtered transactions
  const filtered = transactions.filter(t => {
    if (filterProperty !== "all" && String(t.propertyId) !== filterProperty) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    return true;
  });

  // Property name lookup
  const propName = (id: number) => properties.find(p => p.id === id)?.name ?? `נכס ${id}`;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="ניהול נכסים">
              <rect width="32" height="32" rx="8" fill="hsl(255,70%,65%,0.15)" />
              <path d="M16 6 L28 14 L28 26 L20 26 L20 19 L12 19 L12 26 L4 26 L4 14 Z" fill="none" stroke="hsl(255,70%,65%)" strokeWidth="2" strokeLinejoin="round" />
              <rect x="13" y="20" width="6" height="6" rx="0.5" fill="hsl(255,70%,65%)" opacity="0.4" />
            </svg>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">ניהול נכסים</h1>
              <p className="text-xs text-muted-foreground">העלאת מסמכים ותיעוד הכנסות/הוצאות</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2" data-testid="btn-add">
                <Plus className="w-4 h-4" />
                רישום חדש
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-foreground text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  ניהול נכסים
                </DialogTitle>
                <p className="text-xs text-muted-foreground">העלאת מסמכים ותיעוד הכנסות/הוצאות חכם</p>
              </DialogHeader>
              <TransactionForm onClose={() => setOpen(false)} properties={properties} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="סה״כ הכנסות" value={fmt(income)} icon={TrendingUp} variant="income" />
          <StatCard label="סה״כ הוצאות" value={fmt(expense)} icon={TrendingDown} variant="expense" />
          <StatCard label="רווח נקי" value={fmt(profit)} icon={Wallet} variant="profit" />
          <StatCard label="עסקאות" value={String(transactions.length)} icon={BarChart3} variant="neutral" />
        </div>

        {/* Filters + Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Filter Bar */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
            <Select value={filterProperty} onValueChange={setFilterProperty} data-testid="filter-property">
              <SelectTrigger className="w-44 bg-input border-border text-sm h-8">
                <SelectValue placeholder="כל הנכסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הנכסים</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType} data-testid="filter-type">
              <SelectTrigger className="w-36 bg-input border-border text-sm h-8">
                <SelectValue placeholder="הכל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="income">הכנסות</SelectItem>
                <SelectItem value="expense">הוצאות</SelectItem>
              </SelectContent>
            </Select>

            <div className="mr-auto text-xs text-muted-foreground">
              {filtered.length} רשומות
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {txLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">טוען...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">אין רשומות להצגה</p>
                <p className="text-muted-foreground/60 text-xs mt-1">הוסף רשומה חדשה עם הכפתור למעלה</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">תאריך</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">נכס</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">קטגוריה</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">תיאור</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">סכום</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">סטטוס</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-medium text-right">קובץ</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tx => (
                    <TableRow key={tx.id} className="tx-row border-border" data-testid={`tx-row-${tx.id}`}>
                      <TableCell className="text-xs text-muted-foreground font-mono">{tx.date}</TableCell>
                      <TableCell className="text-xs font-medium">{propName(tx.propertyId)}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{tx.category}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-mono font-semibold ${tx.type === "income" ? "amount-income" : "amount-expense"}`}>
                          {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            tx.paymentStatus === "שולם"
                              ? "border-emerald-500/40 text-emerald-400"
                              : tx.paymentStatus === "ממתין"
                              ? "border-yellow-500/40 text-yellow-400"
                              : "border-orange-500/40 text-orange-400"
                          }`}
                        >
                          {tx.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.fileUrl ? (
                          <div className="flex items-center gap-1">
                            {tx.fileName?.toLowerCase().endsWith(".pdf")
                              ? <FileText className="w-3.5 h-3.5 text-primary/60" />
                              : <Image className="w-3.5 h-3.5 text-primary/60" />}
                            <FileViewer tx={tx} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(tx.id)}
                          data-testid={`btn-delete-${tx.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Per-property summary */}
          {properties.length > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">סיכום לפי נכס</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {properties.map(p => {
                  const pIncome = transactions.filter(t => t.propertyId === p.id && t.type === "income").reduce((s, t) => s + t.amount, 0);
                  const pExpense = transactions.filter(t => t.propertyId === p.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
                  const pProfit = pIncome - pExpense;
                  return (
                    <div key={p.id} className="rounded-lg bg-secondary/50 px-3 py-2" data-testid={`property-summary-${p.id}`}>
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className={`text-sm font-mono font-bold mt-0.5 ${pProfit >= 0 ? "amount-income" : "amount-expense"}`}>
                        {fmt(pProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        <span className="amount-income">+{fmt(pIncome)}</span>{" / "}
                        <span className="amount-expense">-{fmt(pExpense)}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-8 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <PerplexityAttribution />
        </div>
      </footer>
    </div>
  );
}
