import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Users, TrendingUp, TrendingDown, DollarSign, Download } from "lucide-react";
import type { PropertyReport, OwnerReport } from "@shared/schema";

const fmt = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

function KPICard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-bold ${positive === false ? "text-red-400" : positive === true ? "text-green-400" : "text-foreground"}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>("all");
  const yearParam = year === "all" ? "" : `?year=${year}`;

  const { data: propReports = [], isLoading: propLoading } = useQuery<PropertyReport[]>({
    queryKey: ["/api/reports/properties", year],
    queryFn: () => fetch(`/api/reports/properties${yearParam}`).then(r => r.json()),
  });

  const { data: ownerReports = [], isLoading: ownerLoading } = useQuery<OwnerReport[]>({
    queryKey: ["/api/reports/owners", year],
    queryFn: () => fetch(`/api/reports/owners${yearParam}`).then(r => r.json()),
  });

  const totalIncome = propReports.reduce((s, r) => s + r.totalIncome, 0);
  const totalExpenses = propReports.reduce((s, r) => s + r.totalExpenses, 0);
  const totalNet = propReports.reduce((s, r) => s + r.netProfit, 0);
  const totalMonthly = propReports.reduce((s, r) => s + r.monthlyRent, 0);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const handleExportXlsx = () => {
    window.open("/api/export/xlsx", "_blank");
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">דוחות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            נתוני הדוחות נגזרים מחוזי שכירות, הכנסות, הוצאות ותחזוקה
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32" data-testid="select-year">
              <SelectValue placeholder="כל הזמנים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הזמנים</SelectItem>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportXlsx} data-testid="btn-export-xlsx">
            <Download className="h-4 w-4 ml-1" />
            ייצוא XLSX
          </Button>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="סך הכנסות" value={fmt(totalIncome)} sub="מכל הנכסים" positive={true} />
        <KPICard label="סך הוצאות" value={fmt(totalExpenses)} sub="כולל תחזוקה" positive={false} />
        <KPICard label="רווח נקי" value={fmt(totalNet)} sub={totalIncome > 0 ? `מרג' ${pct(totalNet/totalIncome*100)}` : undefined} positive={totalNet >= 0} />
        <KPICard label="שכירה חודשית כוללת" value={fmt(totalMonthly)} sub="מחוזי שכירות פעילים" />
      </div>

      <Tabs defaultValue="properties">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="properties" className="gap-2">
            <Building2 className="h-4 w-4" />
            דוח לפי נכס
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2">
            <Users className="h-4 w-4" />
            דוח לפי בעלים
          </TabsTrigger>
        </TabsList>

        {/* ─── Property Reports ───────────────────────────────────────── */}
        <TabsContent value="properties" className="space-y-4 mt-4">
          {propLoading ? (
            <div className="text-center py-12 text-muted-foreground">טוען...</div>
          ) : propReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">אין נתונים</div>
          ) : (
            propReports.map(r => (
              <Card key={r.property.id} className="bg-card border-border" data-testid={`property-report-${r.property.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{r.property.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{r.property.code} · {r.property.city}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`text-lg font-bold ${r.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(r.netProfit)}</p>
                      <p className="text-xs text-muted-foreground">רווח נקי</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lease info */}
                  {r.lease && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">מקור: חוזה שכירות</p>
                        <p className="text-sm font-medium">{r.lease.tenantName}</p>
                        <p className="text-xs text-muted-foreground">{r.lease.startDate} – {r.lease.endDate}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-primary">{fmt(r.monthlyRent)}/חודש</p>
                        <p className="text-xs text-muted-foreground">שנתי צפוי: {fmt(r.annualRentExpected)}</p>
                        <Badge variant="outline" className="mt-1 text-xs">{r.lease.status}</Badge>
                      </div>
                    </div>
                  )}

                  {/* P&L row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md bg-muted/40 p-3 text-center">
                      <TrendingUp className="h-4 w-4 text-green-400 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">הכנסות</p>
                      <p className="text-sm font-semibold text-green-400">{fmt(r.totalIncome)}</p>
                      <p className="text-xs text-muted-foreground">{r.incomeTransactions.length} עסקאות</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-center">
                      <TrendingDown className="h-4 w-4 text-red-400 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">הוצאות</p>
                      <p className="text-sm font-semibold text-red-400">{fmt(r.totalExpenses)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.expenseTransactions.length} עסקאות + {fmt(r.totalMaintenanceCost)} תחזוקה
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-center">
                      <DollarSign className="h-4 w-4 text-primary mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">מרג' רווח</p>
                      <p className={`text-sm font-semibold ${r.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {r.totalIncome > 0 ? pct(r.netProfit / r.totalIncome * 100) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Owners */}
                  {r.owners.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {r.owners.map(o => (
                        <Badge key={o.id} variant="secondary" className="text-xs">
                          {o.ownerName} {o.ownershipPercent}%
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Maintenance items */}
                  {r.maintenanceItems.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">תחזוקה ותקלות</p>
                      {r.maintenanceItems.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                          <span className="text-foreground">{m.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs py-0">
                              {m.status}
                            </Badge>
                            {m.cost ? <span className="text-red-400">{fmt(m.cost)}</span> : <span className="text-muted-foreground">ללא עלות</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ─── Owner Reports ──────────────────────────────────────────── */}
        <TabsContent value="owners" className="space-y-4 mt-4">
          {ownerLoading ? (
            <div className="text-center py-12 text-muted-foreground">טוען...</div>
          ) : ownerReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">אין נתונים</div>
          ) : (
            ownerReports.map(r => (
              <Card key={r.owner.id} className="bg-card border-border" data-testid={`owner-report-${r.owner.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{r.owner.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{r.owner.code}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`text-lg font-bold ${r.totalNetShare >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {fmt(r.totalNetShare)}
                      </p>
                      <p className="text-xs text-muted-foreground">רווח נקי כולל</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "שכ' חודשית", value: fmt(r.totalMonthlyRentShare), cls: "text-primary" },
                      { label: "הכנסות", value: fmt(r.totalIncomeShare), cls: "text-green-400" },
                      { label: "הוצאות", value: fmt(r.totalExpenseShare), cls: "text-red-400" },
                      { label: "רווח", value: fmt(r.totalNetShare), cls: r.totalNetShare >= 0 ? "text-green-400" : "text-red-400" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="rounded-md bg-muted/40 p-2 text-center">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-sm font-semibold ${cls}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-property breakdown */}
                  <div className="space-y-0">
                    <p className="text-xs text-muted-foreground font-medium mb-2">פירוט לפי נכס</p>
                    {r.properties.map(p => (
                      <div
                        key={p.property.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                      >
                        <div>
                          <span className="text-foreground">{p.property.name}</span>
                          <Badge variant="outline" className="mr-2 text-xs py-0">{p.ownershipPercent}%</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-green-400">{fmt(p.incomeShare)}</span>
                          <span className="text-red-400">-{fmt(p.expenseShare)}</span>
                          <span className={`font-semibold ${p.netShare >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {fmt(p.netShare)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
