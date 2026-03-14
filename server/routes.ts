import type { Express } from "express";
import { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { storage } from "./storage";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export function registerRoutes(httpServer: Server, app: Express) {
  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadsDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // ─── Transactions ───────────────────────────────────────────────────────
  app.get("/api/transactions", async (_req, res) => {
    res.json(await storage.getTransactions());
  });

  app.post("/api/transactions", upload.single("file"), async (req, res) => {
    try {
      const body = req.body;
      const file = req.file;
      const tx = await storage.createTransaction({
        propertyId: parseInt(body.propertyId),
        type: body.type,
        date: body.date,
        amount: parseFloat(body.amount),
        category: body.category,
        description: body.description || null,
        paymentStatus: body.paymentStatus || "שולם",
        expenseType: body.expenseType || null,
        collectionMethod: body.collectionMethod || null,
        fileUrl: file ? `/uploads/${file.filename}` : null,
        fileName: file ? file.originalname : null,
        createdAt: new Date().toISOString().split("T")[0],
      });
      res.json(tx);
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Server error processing upload." });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    await storage.deleteTransaction(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Properties ─────────────────────────────────────────────────────────
  app.get("/api/properties", async (_req, res) => {
    res.json(await storage.getProperties());
  });

  app.get("/api/properties/with-owners", async (_req, res) => {
    res.json(await storage.getPropertiesWithOwners());
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const prop = await storage.createProperty(req.body);
      res.json(prop);
    } catch (err) {
      res.status(500).json({ error: "שגיאה ביצירת הנכס" });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
    const updated = await storage.updateProperty(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "נכס לא נמצא" });
    res.json(updated);
  });

  app.delete("/api/properties/:id", async (req, res) => {
    await storage.deleteProperty(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Owners ─────────────────────────────────────────────────────────────
  app.get("/api/owners", async (_req, res) => {
    res.json(await storage.getOwners());
  });

  app.post("/api/owners", async (req, res) => {
    try {
      const owner = await storage.createOwner(req.body);
      res.json(owner);
    } catch (err) {
      res.status(500).json({ error: "שגיאה ביצירת הבעלים" });
    }
  });

  app.patch("/api/owners/:id", async (req, res) => {
    const updated = await storage.updateOwner(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "בעלים לא נמצא" });
    res.json(updated);
  });

  app.delete("/api/owners/:id", async (req, res) => {
    await storage.deleteOwner(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Property-Owner Assignments ─────────────────────────────────────────
  app.get("/api/property-owners", async (_req, res) => {
    res.json(await storage.getAllPropertyOwners());
  });

  app.get("/api/property-owners/:propertyId", async (req, res) => {
    res.json(await storage.getPropertyOwners(parseInt(req.params.propertyId)));
  });

  app.post("/api/property-owners", async (req, res) => {
    try {
      const po = await storage.createPropertyOwner({
        propertyId: parseInt(req.body.propertyId),
        ownerId: parseInt(req.body.ownerId),
        ownershipPercent: parseFloat(req.body.ownershipPercent) || 100,
        startDate: req.body.startDate || null,
        notes: req.body.notes || null,
      });
      res.json(po);
    } catch (err) {
      res.status(500).json({ error: "שגיאה בשיוך הבעלים" });
    }
  });

  app.patch("/api/property-owners/:id", async (req, res) => {
    const updated = await storage.updatePropertyOwner(parseInt(req.params.id), {
      ownershipPercent: req.body.ownershipPercent ? parseFloat(req.body.ownershipPercent) : undefined,
      startDate: req.body.startDate,
      notes: req.body.notes,
    });
    if (!updated) return res.status(404).json({ error: "שיוך לא נמצא" });
    res.json(updated);
  });

  app.delete("/api/property-owners/:id", async (req, res) => {
    await storage.deletePropertyOwner(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Leases ───────────────────────────────────────────────────────────────

  app.get("/api/leases", async (_req, res) => {
    res.json(await storage.getLeases());
  });

  app.get("/api/leases/property/:propertyId", async (req, res) => {
    res.json(await storage.getLeasesByProperty(parseInt(req.params.propertyId)));
  });

  app.post("/api/leases", async (req, res) => {
    try {
      const body = req.body;
      const lease = await storage.createLease({
        propertyId: parseInt(body.propertyId),
        tenantName: body.tenantName,
        tenantPhone: body.tenantPhone || null,
        tenantEmail: body.tenantEmail || null,
        tenantId: body.tenantId || null,
        startDate: body.startDate,
        endDate: body.endDate,
        monthlyRent: parseFloat(body.monthlyRent),
        depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : null,
        paymentDayOfMonth: parseInt(body.paymentDayOfMonth) || 1,
        status: body.status || "פעיל",
        notes: body.notes || null,
      });
      res.json(lease);
    } catch (err) {
      res.status(500).json({ error: "שגיאה ביצירת חוזה" });
    }
  });

  app.patch("/api/leases/:id", async (req, res) => {
    const body = req.body;
    const updated = await storage.updateLease(parseInt(req.params.id), {
      ...body,
      propertyId: body.propertyId ? parseInt(body.propertyId) : undefined,
      monthlyRent: body.monthlyRent ? parseFloat(body.monthlyRent) : undefined,
      depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : undefined,
      paymentDayOfMonth: body.paymentDayOfMonth ? parseInt(body.paymentDayOfMonth) : undefined,
    });
    if (!updated) return res.status(404).json({ error: "חוזה לא נמצא" });
    res.json(updated);
  });

  app.delete("/api/leases/:id", async (req, res) => {
    await storage.deleteLease(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Maintenance ─────────────────────────────────────────────────────────────

  app.get("/api/maintenance", async (_req, res) => {
    res.json(await storage.getMaintenance());
  });

  app.get("/api/maintenance/property/:propertyId", async (req, res) => {
    res.json(await storage.getMaintenanceByProperty(parseInt(req.params.propertyId)));
  });

  app.post("/api/maintenance", upload.single("file"), async (req, res) => {
    try {
      const body = req.body;
      const file = req.file;
      const item = await storage.createMaintenance({
        propertyId: parseInt(body.propertyId),
        title: body.title,
        description: body.description || null,
        category: body.category,
        status: body.status || "פתוח",
        reportedDate: body.reportedDate,
        resolvedDate: body.resolvedDate || null,
        cost: body.cost ? parseFloat(body.cost) : null,
        paidBy: body.paidBy || "בעלים",
        contractor: body.contractor || null,
        fileUrl: file ? `/uploads/${file.filename}` : null,
        fileName: file ? file.originalname : null,
        notes: body.notes || null,
      });
      res.json(item);
    } catch (err) {
      console.error("Maintenance error:", err);
      res.status(500).json({ error: "שגיאה ביצירת קריאת תחזוקה" });
    }
  });

  app.patch("/api/maintenance/:id", async (req, res) => {
    const body = req.body;
    const updated = await storage.updateMaintenance(parseInt(req.params.id), {
      ...body,
      propertyId: body.propertyId ? parseInt(body.propertyId) : undefined,
      cost: body.cost !== undefined ? (body.cost ? parseFloat(body.cost) : null) : undefined,
    });
    if (!updated) return res.status(404).json({ error: "קריאה לא נמצאה" });
    res.json(updated);
  });

  app.delete("/api/maintenance/:id", async (req, res) => {
    await storage.deleteMaintenance(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Reports ───────────────────────────────────────────────────────────────

  app.get("/api/reports/properties", async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    res.json(await storage.getPropertyReports(year));
  });

  app.get("/api/reports/owners", async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    res.json(await storage.getOwnerReports(year));
  });

  // ─── XLSX Export/Import ─────────────────────────────────────────────────────

  app.get("/api/export/xlsx", async (_req, res) => {
    try {
      const [properties, owners, allPO, leases, transactions, maintenance, propReports, ownerReports] = await Promise.all([
        storage.getProperties(),
        storage.getOwners(),
        storage.getAllPropertyOwners(),
        storage.getLeases(),
        storage.getTransactions(),
        storage.getMaintenance(),
        storage.getPropertyReports(),
        storage.getOwnerReports(),
      ]);

      const wb = XLSX.utils.book_new();

      // נכסים
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(properties.map(p => ({
          "קוד נכס": p.code, "שם נכס": p.name, "כתובת": p.address, "עיר": p.city, "סוג": p.type, "הערות": p.notes ?? "",
        }))), "נכסים");

      // בעלים
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(owners.map(o => ({
          "קוד בעל": o.code, "שם": o.name, "טלפון": o.phone ?? "", "אימייל": o.email ?? "",
          "תעודת זהות": o.idNumber ?? "", "חשבון בנק": o.bankAccount ?? "", "הערות": o.notes ?? "",
        }))), "בעלים");

      // בעלות ואחוזים
      const ownerMap = new Map(owners.map(o => [o.id, o.name]));
      const propMap = new Map(properties.map(p => [p.id, p.name]));
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(allPO.map(po => ({
          "נכס": propMap.get(po.propertyId) ?? po.propertyId,
          "בעל": ownerMap.get(po.ownerId) ?? po.ownerId,
          "אחוזת בעלות (%)": po.ownershipPercent,
          "תאריך תחילה": po.startDate ?? "",
        }))), "בעלות ואחוזים");

      // חוזי שכירות
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(leases.map(l => ({
          "נכס": propMap.get(l.propertyId) ?? l.propertyId,
          "שוכר": l.tenantName, "טלפון שוכר": l.tenantPhone ?? "", "אימייל שוכר": l.tenantEmail ?? "",
          "תעודת זהות שוכר": l.tenantId ?? "",
          "תאריך תחילה": l.startDate, "תאריך סיום": l.endDate,
          "שכירה חודשית": l.monthlyRent, "פיקדון": l.depositAmount ?? 0,
          "יום תשלום": l.paymentDayOfMonth, "סטאטוס": l.status, "הערות": l.notes ?? "",
        }))), "חוזי שכירות");

      // הכנסות
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(
          transactions.filter(t => t.type === "income").map(t => ({
            "נכס": propMap.get(t.propertyId) ?? t.propertyId,
            "תאריך": t.date, "סכום": t.amount, "קטגוריה": t.category,
            "תיאור": t.description ?? "", "סטאטוס תשלום": t.paymentStatus,
            "אמצעי גבייה": t.collectionMethod ?? "",
          }))
        ), "הכנסות");

      // הוצאות
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(
          transactions.filter(t => t.type === "expense").map(t => ({
            "נכס": propMap.get(t.propertyId) ?? t.propertyId,
            "תאריך": t.date, "סכום": t.amount, "קטגוריה": t.category,
            "תיאור": t.description ?? "", "סטאטוס תשלום": t.paymentStatus,
            "סוג הוצאה": t.expenseType ?? "",
          }))
        ), "הוצאות");

      // תחזוקה ותקלות
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(maintenance.map(m => ({
          "נכס": propMap.get(m.propertyId) ?? m.propertyId,
          "כותרת": m.title, "תיאור": m.description ?? "", "קטגוריה": m.category,
          "סטאטוס": m.status, "תאריך דיווח": m.reportedDate, "תאריך סגירה": m.resolvedDate ?? "",
          "עלות": m.cost ?? 0, "משלם ע": m.paidBy, "קבלן": m.contractor ?? "",
        }))), "תחזוקה ותקלות");

      // דוח לפי נכס
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(propReports.map(r => ({
          "נכס": r.property.name, "קוד": r.property.code,
          "שכירה חודשית": r.monthlyRent, "שכירה שנתית צפויה": r.annualRentExpected,
          "סך הכנסות": r.totalIncome, "סך הוצאות": r.totalExpenses,
          "עלות תחזוקה": r.totalMaintenanceCost, "רווח נקי": r.netProfit,
          "בעלים": r.owners.map(o => `${o.ownerName} ${o.ownershipPercent}%`).join(", "),
        }))), "דוח לפי נכס");

      // דוח לפי בעלים
      const ownerRows: Record<string, any>[] = [];
      for (const r of ownerReports) {
        for (const p of r.properties) {
          ownerRows.push({
            "בעל": r.owner.name,
            "נכס": p.property.name,
            "אחוזת בעלות": p.ownershipPercent,
            "חלק הכנסות": Math.round(p.incomeShare),
            "חלק הוצאות": Math.round(p.expenseShare),
            "חלק רווח": Math.round(p.netShare),
            "חלק שכירה חודשית": Math.round(p.monthlyRentShare),
          });
        }
        ownerRows.push({
          "בעל": `סנת כל נכסי ${r.owner.name}`,
          "נכס": "",
          "אחוזת בעלות": "",
          "חלק הכנסות": Math.round(r.totalIncomeShare),
          "חלק הוצאות": Math.round(r.totalExpenseShare),
          "חלק רווח": Math.round(r.totalNetShare),
          "חלק שכירה חודשית": Math.round(r.totalMonthlyRentShare),
        });
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ownerRows), "דוח לפי בעלים");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `ניהול_נכסים_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("XLSX export error:", err);
      res.status(500).json({ error: "שגיאה בייצוא XLSX" });
    }
  });

  const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  app.post("/api/import/xlsx", xlsxUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "לא נבחר קובץ" });
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetNames = wb.SheetNames;
      const result: Record<string, number> = {};

      // Helper to parse a sheet
      const getSheet = (name: string) => {
        const sn = sheetNames.find(s => s === name || s.includes(name.slice(0, 4)));
        if (!sn) return [];
        return XLSX.utils.sheet_to_json(wb.Sheets[sn]) as Record<string, any>[];
      };

      // Import Properties
      const propsSheet = getSheet("נכסים");
      let imported = 0;
      for (const row of propsSheet) {
        if (!row["שם נכס"]) continue;
        await storage.createProperty({
          code: row["קוד נכס"] || "",
          name: row["שם נכס"],
          address: row["כתובת"] || "",
          city: row["עיר"] || "",
          type: row["סוג"] || "דירת מגורים",
          notes: row["הערות"] || null,
        });
        imported++;
      }
      result["נכסים"] = imported;

      // Import Owners
      const ownersSheet = getSheet("בעלים");
      imported = 0;
      for (const row of ownersSheet) {
        if (!row["שם"]) continue;
        await storage.createOwner({
          code: row["קוד בעל"] || "",
          name: row["שם"],
          phone: row["טלפון"] || null,
          email: row["אימייל"] || null,
          idNumber: row["תעודת זהות"] || null,
          bankAccount: row["חשבון בנק"] || null,
          notes: row["הערות"] || null,
        });
        imported++;
      }
      result["בעלים"] = imported;

      // Import Leases
      const leasesSheet = getSheet("חוזי");
      const props = await storage.getProperties();
      const propByName = new Map(props.map(p => [p.name, p]));
      const propByCode = new Map(props.map(p => [p.code, p]));
      imported = 0;
      for (const row of leasesSheet) {
        if (!row["שכירה חודשית"]) continue;
        const prop = propByName.get(row["נכס"]) || propByCode.get(row["נכס"]);
        if (!prop) continue;
        await storage.createLease({
          propertyId: prop.id,
          tenantName: row["שוכר"] || "",
          tenantPhone: row["טלפון שוכר"] || null,
          tenantEmail: row["אימייל שוכר"] || null,
          tenantId: row["תעודת זהות שוכר"] || null,
          startDate: String(row["תאריך תחילה"] || ""),
          endDate: String(row["תאריך סיום"] || ""),
          monthlyRent: parseFloat(row["שכירה חודשית"]) || 0,
          depositAmount: parseFloat(row["פיקדון"]) || null,
          paymentDayOfMonth: parseInt(row["יום תשלום"]) || 1,
          status: row["סטאטוס"] || "פעיל",
          notes: row["הערות"] || null,
        });
        imported++;
      }
      result["חוזי שכירות"] = imported;

      // Import Maintenance
      const maintSheet = getSheet("תחזוקה");
      imported = 0;
      for (const row of maintSheet) {
        if (!row["כותרת"]) continue;
        const prop = propByName.get(row["נכס"]) || propByCode.get(row["נכס"]);
        if (!prop) continue;
        await storage.createMaintenance({
          propertyId: prop.id,
          title: row["כותרת"],
          description: row["תיאור"] || null,
          category: row["קטגוריה"] || "אחר",
          status: row["סטאטוס"] || "פתוח",
          reportedDate: String(row["תאריך דיווח"] || new Date().toISOString().split("T")[0]),
          resolvedDate: row["תאריך סגירה"] || null,
          cost: parseFloat(row["עלות"]) || null,
          paidBy: row["משלם ע"] || "בעלים",
          contractor: row["קבלן"] || null,
          notes: row["הערות"] || null,
        });
        imported++;
      }
      result["תחזוקה"] = imported;

      res.json({ ok: true, imported: result });
    } catch (err: any) {
      console.error("XLSX import error:", err);
      res.status(500).json({ error: "שגיאה בייבוא XLSX" });
    }
  });

  // ─── Sync ────────────────────────────────────────────────────────────────

  // Export full snapshot as JSON
  app.get("/api/sync/export", async (_req, res) => {
    const snapshot = await storage.exportSnapshot();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="sync-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(snapshot);
  });

  // Import + sync from JSON payload
  app.post("/api/sync/import", async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || !payload.strategy || !Array.isArray(payload.properties)) {
        return res.status(400).json({ error: "פורמט קובץ לא תקין" });
      }
      const result = await storage.importSync(payload);
      res.json(result);
    } catch (err: any) {
      console.error("Sync import error:", err);
      res.status(500).json({ error: "שגיאה בסנכרון" });
    }
  });

  // Get sync history
  app.get("/api/sync/history", async (_req, res) => {
    res.json(await storage.getSyncHistory());
  });

  // Resolve a conflict manually (overwrite local with incoming data)
  app.post("/api/sync/resolve", async (req, res) => {
    try {
      const { entityType, id, winner, data } = req.body;
      if (winner === "incoming" && data) {
        if (entityType === "properties") await storage.updateProperty(id, data);
        else if (entityType === "owners") await storage.updateOwner(id, data);
        else if (entityType === "transactions") await storage.updateTransaction(id, data);
      }
      res.json({ ok: true, winner });
    } catch (err) {
      res.status(500).json({ error: "שגיאה בפתרון קונפליקט" });
    }
  });
}
