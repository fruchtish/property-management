import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import type { SyncHistoryEntry } from "@/../../server/storage";

function DataSourceTable() {
  const sources = [
    { sheet: "חוזי שכירות", data: "הכנסות שכירות", note: "monthlyRent × חודשים" },
    { sheet: "נכסים", data: "רשימת נכסים", note: "קוד, שם, עיר, סוג" },
    { sheet: "בעלים", data: "פרטי בעלים", note: "קוד, שם, טלפון, אימייל" },
    { sheet: "בעלות ואחוזים", data: "שיוך ואחוז בעלות", note: "בסיס לחישוב דוח בעלים" },
    { sheet: "הכנסות", data: "עסקאות הכנסה", note: "בנוסף על חוזי שכירות" },
    { sheet: "הוצאות", data: "עסקאות הוצאה", note: "ישירות + עקיפות" },
    { sheet: "תחזוקה ותקלות", data: "הוצאות תחזוקה", note: "paidBy=בעלים מחושב ב-P&L" },
    { sheet: "דוח לפי נכס", data: "P&L לכל נכס", note: "מחושב אוטומטית" },
    { sheet: "דוח לפי בעלים", data: "חלק כל בעלים", note: "מחושב לפי אחוז בעלות" },
  ];

  return (
    <div className="space-y-2">
      {sources.map(({ sheet, data, note }) => (
        <div key={sheet} className="flex items-start gap-3 py-2 border-b border-border last:border-0 text-sm">
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground">{sheet}</span>
            <span className="text-muted-foreground mx-1.5">→</span>
            <span className="text-foreground">{data}</span>
          </div>
          <span className="text-xs text-muted-foreground text-left">{note}</span>
        </div>
      ))}
    </div>
  );
}

export default function Sync() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<Record<string, number> | null>(null);

  const { data: history = [], refetch: refetchHistory } = useQuery<SyncHistoryEntry[]>({
    queryKey: ["/api/sync/history"],
  });

  const handleExport = () => {
    window.open("/api/export/xlsx", "_blank");
    toast({ title: "ייצוא XLSX", description: "הקובץ מוריד אוטומטית" });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({ title: "קובץ לא תקין", description: "יש להעלות קובץ Excel (.xlsx)", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/xlsx", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok) {
        setLastImportResult(data.imported);
        toast({ title: "ייבוא הושלם", description: `יובאו: ${Object.entries(data.imported).map(([k, v]) => `${v} ${k}`).join(", ")}` });
        refetchHistory();
      } else {
        toast({ title: "שגיאה בייבוא", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "שגיאה בחיבור", description: "לא ניתן ליבא את הקובץ", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">סנכרון נתונים</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Google Drive / Excel הוא מקור הנתונים הראשי. האפליקציה משקפת את תוכן הגיליון.
        </p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              ייצוא ל-Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              מייצא את כל הנתונים לקובץ .xlsx עם 9 גיליונות — נכסים, בעלים, חוזים, הכנסות, הוצאות, תחזוקה ושני דוחות.
            </p>
            <Button className="w-full" onClick={handleExport} data-testid="btn-export">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              הורד קובץ XLSX
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-green-400" />
              ייבוא מ-Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              טוען נכסים, בעלים, חוזי שכירות ותחזוקה מקובץ .xlsx. ייבוא יוסיף רשומות חדשות לנתונים הקיימים.
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={handleImportClick}
              disabled={importing}
              data-testid="btn-import"
            >
              {importing ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 ml-2" />
              )}
              {importing ? "מייבא..." : "בחר קובץ XLSX"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
          </CardContent>
        </Card>
      </div>

      {/* Last import result */}
      {lastImportResult && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">ייבוא אחרון הצליח</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(lastImportResult).map(([key, count]) => (
                    <Badge key={key} variant="outline" className="text-xs border-green-500/30 text-green-300">
                      {count} {key}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data hierarchy info */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            מבנה הנתונים — מי קובע מה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            לכל שדה יש מקור מוגדר. הדוחות מחושבים אוטומטית לפי ההיררכיה הבאה:
          </p>
          <DataSourceTable />
        </CardContent>
      </Card>

      {/* Sync history */}
      {history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              היסטוריית סנכרון
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.slice(0, 10).map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-foreground font-medium">{h.syncedAt.split("T")[0]}</span>
                    <span className="text-muted-foreground mr-2">{h.syncedAt.split("T")[1]?.slice(0, 5)}</span>
                    <Badge variant="outline" className="text-xs mr-1">{h.strategy}</Badge>
                  </div>
                  <div className="flex gap-3 text-muted-foreground">
                    <span className="text-green-400">+{h.created}</span>
                    <span className="text-blue-400">↑{h.updated}</span>
                    <span>={h.skipped}</span>
                    {h.conflicts > 0 && <span className="text-yellow-400">⚠{h.conflicts}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
