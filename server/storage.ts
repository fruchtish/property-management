import {
  Transaction, InsertTransaction,
  Property, InsertProperty,
  Owner, InsertOwner,
  PropertyOwner, InsertPropertyOwner,
  PropertyOwnerWithDetails, PropertyWithOwners,
  Lease, InsertLease,
  Maintenance, InsertMaintenance,
  PropertyReport, OwnerReport,
  SyncPayload, SyncResult, SyncConflict, SyncStrategy, SyncRecord, SyncEntityType,
} from "@shared/schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

/** Compare two records per strategy. Returns true if `incoming` should overwrite `local`. */
function shouldOverwrite(
  local: { version: number; updatedAt: string },
  incoming: { version: number; updatedAt: string },
  strategy: SyncStrategy
): boolean {
  switch (strategy) {
    case "last_write_wins":
      return incoming.updatedAt > local.updatedAt;
    case "highest_version":
      return incoming.version > local.version;
    case "local_wins":
      return false;
    case "incoming_wins":
      return true;
    case "manual":
      return false; // surface conflict, don't auto-resolve
    default:
      return false;
  }
}

function toSyncRecord(entityType: SyncEntityType, rec: Property | Owner | Transaction): SyncRecord {
  return {
    id: rec.id,
    entityType,
    version: rec.version,
    updatedAt: rec.updatedAt,
    data: rec as Record<string, unknown>,
  };
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IStorage {
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByProperty(propertyId: number): Promise<Transaction[]>;
  createTransaction(t: InsertTransaction & { createdAt: string; fileUrl?: string | null; fileName?: string | null }): Promise<Transaction>;
  updateTransaction(id: number, t: Partial<Transaction>): Promise<Transaction | null>;
  deleteTransaction(id: number): Promise<void>;

  // Properties
  getProperties(): Promise<Property[]>;
  getPropertiesWithOwners(): Promise<PropertyWithOwners[]>;
  createProperty(p: InsertProperty): Promise<Property>;
  updateProperty(id: number, p: Partial<InsertProperty>): Promise<Property | null>;
  deleteProperty(id: number): Promise<void>;

  // Owners
  getOwners(): Promise<Owner[]>;
  createOwner(o: InsertOwner): Promise<Owner>;
  updateOwner(id: number, o: Partial<InsertOwner>): Promise<Owner | null>;
  deleteOwner(id: number): Promise<void>;

  // Property-Owner assignments
  getPropertyOwners(propertyId: number): Promise<PropertyOwnerWithDetails[]>;
  getAllPropertyOwners(): Promise<PropertyOwner[]>;
  createPropertyOwner(po: InsertPropertyOwner): Promise<PropertyOwner>;
  updatePropertyOwner(id: number, po: Partial<InsertPropertyOwner>): Promise<PropertyOwner | null>;
  deletePropertyOwner(id: number): Promise<void>;

  // Leases
  getLeases(): Promise<Lease[]>;
  getLeasesByProperty(propertyId: number): Promise<Lease[]>;
  getActiveLease(propertyId: number): Promise<Lease | null>;
  createLease(l: InsertLease): Promise<Lease>;
  updateLease(id: number, l: Partial<InsertLease>): Promise<Lease | null>;
  deleteLease(id: number): Promise<void>;

  // Maintenance
  getMaintenance(): Promise<Maintenance[]>;
  getMaintenanceByProperty(propertyId: number): Promise<Maintenance[]>;
  createMaintenance(m: InsertMaintenance & { fileUrl?: string | null; fileName?: string | null }): Promise<Maintenance>;
  updateMaintenance(id: number, m: Partial<Maintenance>): Promise<Maintenance | null>;
  deleteMaintenance(id: number): Promise<void>;

  // Reports (computed from source-of-truth tables)
  getPropertyReports(year?: number): Promise<PropertyReport[]>;
  getOwnerReports(year?: number): Promise<OwnerReport[]>;

  // Sync
  exportSnapshot(): Promise<SyncPayload>;
  importSync(payload: SyncPayload): Promise<SyncResult>;
  getSyncHistory(): Promise<SyncHistoryEntry[]>;
}

export interface SyncHistoryEntry {
  id: number;
  syncedAt: string;
  strategy: SyncStrategy;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  source: string;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class MemStorage implements IStorage {
  private transactions: Transaction[] = [];
  private properties: Property[] = [];
  private owners: Owner[] = [];
  private propertyOwners: PropertyOwner[] = [];
  private leases: Lease[] = [];
  private maintenanceItems: Maintenance[] = [];
  private syncHistory: SyncHistoryEntry[] = [];
  private txId = 1;
  private propId = 1;
  private ownId = 1;
  private poId = 1;
  private leaseId = 1;
  private maintId = 1;
  private syncHistoryId = 1;

  constructor() {
    const ts = now();

    this.properties = [
      { id: 1, code: "P001", name: "דירת הירקון", address: "הירקון 45", city: "תל אביב", type: "דירת מגורים", notes: null, version: 1, updatedAt: ts },
      { id: 2, code: "P002", name: "משרד רמת החיל", address: "דרך השלום 78", city: "תל אביב", type: "משרד", notes: null, version: 1, updatedAt: ts },
      { id: 3, code: "P003", name: "וילה הרצליה", address: "בן גוריון 12", city: "הרצליה", type: "וילה", notes: null, version: 1, updatedAt: ts },
      { id: 4, code: "P004", name: "דירה נתניה", address: "הרצל 33", city: "נתניה", type: "דירת מגורים", notes: null, version: 1, updatedAt: ts },
    ];
    this.propId = 5;

    this.owners = [
      { id: 1, code: "O001", name: "דוד כהן", phone: "050-1234567", email: "david@gmail.com", idNumber: "123456789", bankAccount: "12-345-678901", notes: null, version: 1, updatedAt: ts },
      { id: 2, code: "O002", name: "שרה לוי", phone: "052-9876543", email: "sara@gmail.com", idNumber: "987654321", bankAccount: "11-222-333444", notes: null, version: 1, updatedAt: ts },
      { id: 3, code: "O003", name: "יוסי מזרחי", phone: "054-4567891", email: "yossi@gmail.com", idNumber: "456789123", bankAccount: "10-111-222333", notes: null, version: 1, updatedAt: ts },
    ];
    this.ownId = 4;

    this.propertyOwners = [
      { id: 1, propertyId: 1, ownerId: 1, ownershipPercent: 100, startDate: "2023-01-01", notes: null },
      { id: 2, propertyId: 2, ownerId: 1, ownershipPercent: 50, startDate: "2022-06-01", notes: null },
      { id: 3, propertyId: 2, ownerId: 2, ownershipPercent: 50, startDate: "2022-06-01", notes: null },
      { id: 4, propertyId: 3, ownerId: 2, ownershipPercent: 60, startDate: "2021-01-01", notes: null },
      { id: 5, propertyId: 3, ownerId: 3, ownershipPercent: 40, startDate: "2021-01-01", notes: null },
      { id: 6, propertyId: 4, ownerId: 3, ownershipPercent: 100, startDate: "2024-03-01", notes: null },
    ];
    this.poId = 7;

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const m = (months: number) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - months);
      return fmt(d);
    };

    this.transactions = [
      { id: 1, propertyId: 1, type: "income", date: m(0), amount: 7200, category: "שכירות", description: "שכירות חודשית", paymentStatus: "שולם", expenseType: null, collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 2, propertyId: 2, type: "income", date: m(0), amount: 14000, category: "שכירות", description: "שכירות חודשית", paymentStatus: "שולם", expenseType: null, collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 3, propertyId: 3, type: "income", date: m(0), amount: 22000, category: "שכירות", description: "שכירות חודשית", paymentStatus: "שולם", expenseType: null, collectionMethod: "שיק", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 4, propertyId: 1, type: "income", date: m(1), amount: 7200, category: "שכירות", description: "שכירות חודשית", paymentStatus: "שולם", expenseType: null, collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(1), version: 1, updatedAt: ts },
      { id: 5, propertyId: 1, type: "expense", date: m(0), amount: 1000, category: "ארנונה", description: "ארנונה חודשית", paymentStatus: "שולם", expenseType: "הוצאה ישירה", collectionMethod: "מזומן", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 6, propertyId: 1, type: "expense", date: m(0), amount: 500, category: "ועד בית", description: "ועד בית חודשי", paymentStatus: "שולם", expenseType: "הוצאה ישירה", collectionMethod: "שיק", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 7, propertyId: 2, type: "expense", date: m(0), amount: 2500, category: "תיקון/תחזוקה", description: "תיקון מזגן", paymentStatus: "שולם", expenseType: "תיקון/תחזוקה", collectionMethod: "מזומן", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 8, propertyId: 3, type: "expense", date: m(1), amount: 5500, category: "תיקון/תחזוקה", description: "תיקון גדר", paymentStatus: "שולם", expenseType: "תיקון/תחזוקה", collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(1), version: 1, updatedAt: ts },
      { id: 9, propertyId: 1, type: "expense", date: m(0), amount: 2500, category: "עורך דין", description: "עריכת חוזה שכירות", paymentStatus: "שולם", expenseType: "הוצאה עקיפה", collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(0), version: 1, updatedAt: ts },
      { id: 10, propertyId: 2, type: "income", date: m(1), amount: 14000, category: "שכירות", description: "שכירות חודשית", paymentStatus: "שולם", expenseType: null, collectionMethod: "העברה בנקאית", fileUrl: null, fileName: null, createdAt: m(1), version: 1, updatedAt: ts },
    ];
    this.txId = 11;

    // Seed leases (source of truth for rental income)
    this.leases = [
      { id: 1, propertyId: 1, tenantName: "יועד כהן", tenantPhone: "054-1111111", tenantEmail: "yoav@email.com", tenantId: "111111111", startDate: "2024-01-01", endDate: "2026-12-31", monthlyRent: 7200, depositAmount: 14400, paymentDayOfMonth: 1, status: "פעיל", notes: null, version: 1, updatedAt: ts },
      { id: 2, propertyId: 2, tenantName: "חברת טכנולוגיה בע\"מ", tenantPhone: "03-5555555", tenantEmail: "office@tech.co.il", tenantId: "555555555", startDate: "2022-06-01", endDate: "2027-05-31", monthlyRent: 14000, depositAmount: 42000, paymentDayOfMonth: 5, status: "פעיל", notes: null, version: 1, updatedAt: ts },
      { id: 3, propertyId: 3, tenantName: "משפחת לוי", tenantPhone: "052-2222222", tenantEmail: "levi@gmail.com", tenantId: "222222222", startDate: "2023-07-01", endDate: "2025-06-30", monthlyRent: 22000, depositAmount: 44000, paymentDayOfMonth: 1, status: "פעיל", notes: null, version: 1, updatedAt: ts },
      { id: 4, propertyId: 4, tenantName: "אבי נחמנ", tenantPhone: "050-3333333", tenantEmail: "avi@email.com", tenantId: "333333333", startDate: "2024-04-01", endDate: "2026-03-31", monthlyRent: 5800, depositAmount: 11600, paymentDayOfMonth: 3, status: "פעיל", notes: null, version: 1, updatedAt: ts },
    ];
    this.leaseId = 5;

    // Seed maintenance items (source of truth for maintenance expenses)
    const mo = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.toISOString().split("T")[0]; };
    this.maintenanceItems = [
      { id: 1, propertyId: 2, title: "תיקון מזגן", description: "חלפת קומפרסור", category: "מזגן", status: "סגור", reportedDate: mo(2), resolvedDate: mo(1), cost: 2500, paidBy: "בעלים", contractor: "קרמני אירוג", fileUrl: null, fileName: null, notes: null, version: 1, updatedAt: ts },
      { id: 2, propertyId: 3, title: "תיקון גדר", description: "סדק בגדר החיצוני", category: "בנייה", status: "סגור", reportedDate: mo(3), resolvedDate: mo(2), cost: 5500, paidBy: "בעלים", contractor: "בניין ישראלי", fileUrl: null, fileName: null, notes: null, version: 1, updatedAt: ts },
      { id: 3, propertyId: 1, title: "ריבוץ דלת", description: "דלת יציאה סדוקה", category: "בנייה", status: "בטיפול", reportedDate: mo(0), resolvedDate: null, cost: 1200, paidBy: "בעלים", contractor: null, fileUrl: null, fileName: null, notes: null, version: 1, updatedAt: ts },
      { id: 4, propertyId: 4, title: "תקלה חשמל", description: "הפסקת חשמל בסלון", category: "חשמל", status: "פתוח", reportedDate: mo(0), resolvedDate: null, cost: null, paidBy: "בעלים", contractor: null, fileUrl: null, fileName: null, notes: null, version: 1, updatedAt: ts },
    ];
    this.maintId = 5;
  }

  // ─── Transactions ────────────────────────────────────────────────────────
  async getTransactions(): Promise<Transaction[]> {
    return [...this.transactions].sort((a, b) => b.id - a.id);
  }

  async getTransactionsByProperty(propertyId: number): Promise<Transaction[]> {
    return this.transactions.filter(t => t.propertyId === propertyId);
  }

  async createTransaction(t: InsertTransaction & { createdAt: string; fileUrl?: string | null; fileName?: string | null }): Promise<Transaction> {
    const tx: Transaction = {
      id: this.txId++,
      propertyId: t.propertyId,
      type: t.type,
      date: t.date,
      amount: t.amount,
      category: t.category,
      description: t.description ?? null,
      paymentStatus: t.paymentStatus ?? "שולם",
      expenseType: t.expenseType ?? null,
      collectionMethod: t.collectionMethod ?? null,
      fileUrl: t.fileUrl ?? null,
      fileName: t.fileName ?? null,
      createdAt: t.createdAt,
      version: 1,
      updatedAt: now(),
    };
    this.transactions.push(tx);
    return tx;
  }

  async updateTransaction(id: number, t: Partial<Transaction>): Promise<Transaction | null> {
    const idx = this.transactions.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.transactions[idx] = {
      ...this.transactions[idx],
      ...t,
      version: this.transactions[idx].version + 1,
      updatedAt: now(),
    };
    return this.transactions[idx];
  }

  async deleteTransaction(id: number): Promise<void> {
    this.transactions = this.transactions.filter(t => t.id !== id);
  }

  // ─── Properties ──────────────────────────────────────────────────────────
  async getProperties(): Promise<Property[]> {
    return [...this.properties];
  }

  async getPropertiesWithOwners(): Promise<PropertyWithOwners[]> {
    return this.properties.map(prop => ({
      ...prop,
      owners: this.propertyOwners
        .filter(po => po.propertyId === prop.id)
        .map(po => {
          const owner = this.owners.find(o => o.id === po.ownerId);
          return {
            ...po,
            ownerName: owner?.name ?? "לא ידוע",
            ownerPhone: owner?.phone ?? null,
            ownerEmail: owner?.email ?? null,
          };
        }),
    }));
  }

  async createProperty(p: InsertProperty): Promise<Property> {
    const nextCode = `P${String(this.propId).padStart(3, "0")}`;
    const prop: Property = { id: this.propId++, code: p.code || nextCode, ...p, notes: p.notes ?? null, version: 1, updatedAt: now() };
    this.properties.push(prop);
    return prop;
  }

  async updateProperty(id: number, p: Partial<InsertProperty>): Promise<Property | null> {
    const idx = this.properties.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.properties[idx] = { ...this.properties[idx], ...p, version: this.properties[idx].version + 1, updatedAt: now() };
    return this.properties[idx];
  }

  async deleteProperty(id: number): Promise<void> {
    this.properties = this.properties.filter(p => p.id !== id);
    this.propertyOwners = this.propertyOwners.filter(po => po.propertyId !== id);
  }

  // ─── Owners ──────────────────────────────────────────────────────────────
  async getOwners(): Promise<Owner[]> {
    return [...this.owners];
  }

  async createOwner(o: InsertOwner): Promise<Owner> {
    const nextCode = `O${String(this.ownId).padStart(3, "0")}`;
    const owner: Owner = {
      id: this.ownId++,
      code: o.code || nextCode,
      name: o.name,
      phone: o.phone ?? null,
      email: o.email ?? null,
      idNumber: o.idNumber ?? null,
      bankAccount: o.bankAccount ?? null,
      notes: o.notes ?? null,
      version: 1,
      updatedAt: now(),
    };
    this.owners.push(owner);
    return owner;
  }

  async updateOwner(id: number, o: Partial<InsertOwner>): Promise<Owner | null> {
    const idx = this.owners.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.owners[idx] = { ...this.owners[idx], ...o, version: this.owners[idx].version + 1, updatedAt: now() };
    return this.owners[idx];
  }

  async deleteOwner(id: number): Promise<void> {
    this.owners = this.owners.filter(o => o.id !== id);
    this.propertyOwners = this.propertyOwners.filter(po => po.ownerId !== id);
  }

  // ─── Property-Owner Assignments ──────────────────────────────────────────
  async getPropertyOwners(propertyId: number): Promise<PropertyOwnerWithDetails[]> {
    return this.propertyOwners
      .filter(po => po.propertyId === propertyId)
      .map(po => {
        const owner = this.owners.find(o => o.id === po.ownerId);
        return { ...po, ownerName: owner?.name ?? "לא ידוע", ownerPhone: owner?.phone ?? null, ownerEmail: owner?.email ?? null };
      });
  }

  async getAllPropertyOwners(): Promise<PropertyOwner[]> {
    return [...this.propertyOwners];
  }

  async createPropertyOwner(po: InsertPropertyOwner): Promise<PropertyOwner> {
    const item: PropertyOwner = { id: this.poId++, ...po, notes: po.notes ?? null, startDate: po.startDate ?? null };
    this.propertyOwners.push(item);
    return item;
  }

  async updatePropertyOwner(id: number, po: Partial<InsertPropertyOwner>): Promise<PropertyOwner | null> {
    const idx = this.propertyOwners.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.propertyOwners[idx] = { ...this.propertyOwners[idx], ...po };
    return this.propertyOwners[idx];
  }

  async deletePropertyOwner(id: number): Promise<void> {
    this.propertyOwners = this.propertyOwners.filter(po => po.id !== id);
  }

  // ─── Leases ──────────────────────────────────────────────────────────────
  async getLeases(): Promise<Lease[]> {
    return [...this.leases].sort((a, b) => b.id - a.id);
  }

  async getLeasesByProperty(propertyId: number): Promise<Lease[]> {
    return this.leases.filter(l => l.propertyId === propertyId);
  }

  async getActiveLease(propertyId: number): Promise<Lease | null> {
    return this.leases.find(l => l.propertyId === propertyId && l.status === "פעיל") ?? null;
  }

  async createLease(l: InsertLease): Promise<Lease> {
    const lease: Lease = {
      id: this.leaseId++,
      propertyId: l.propertyId,
      tenantName: l.tenantName,
      tenantPhone: l.tenantPhone ?? null,
      tenantEmail: l.tenantEmail ?? null,
      tenantId: l.tenantId ?? null,
      startDate: l.startDate,
      endDate: l.endDate,
      monthlyRent: l.monthlyRent,
      depositAmount: l.depositAmount ?? null,
      paymentDayOfMonth: l.paymentDayOfMonth ?? 1,
      status: l.status ?? "פעיל",
      notes: l.notes ?? null,
      version: 1,
      updatedAt: now(),
    };
    this.leases.push(lease);
    return lease;
  }

  async updateLease(id: number, l: Partial<InsertLease>): Promise<Lease | null> {
    const idx = this.leases.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.leases[idx] = { ...this.leases[idx], ...l, version: this.leases[idx].version + 1, updatedAt: now() };
    return this.leases[idx];
  }

  async deleteLease(id: number): Promise<void> {
    this.leases = this.leases.filter(l => l.id !== id);
  }

  // ─── Maintenance ──────────────────────────────────────────────────────────
  async getMaintenance(): Promise<Maintenance[]> {
    return [...this.maintenanceItems].sort((a, b) => b.id - a.id);
  }

  async getMaintenanceByProperty(propertyId: number): Promise<Maintenance[]> {
    return this.maintenanceItems.filter(m => m.propertyId === propertyId);
  }

  async createMaintenance(m: InsertMaintenance & { fileUrl?: string | null; fileName?: string | null }): Promise<Maintenance> {
    const item: Maintenance = {
      id: this.maintId++,
      propertyId: m.propertyId,
      title: m.title,
      description: m.description ?? null,
      category: m.category,
      status: m.status ?? "פתוח",
      reportedDate: m.reportedDate,
      resolvedDate: m.resolvedDate ?? null,
      cost: m.cost ?? null,
      paidBy: m.paidBy ?? "בעלים",
      contractor: m.contractor ?? null,
      fileUrl: m.fileUrl ?? null,
      fileName: m.fileName ?? null,
      notes: m.notes ?? null,
      version: 1,
      updatedAt: now(),
    };
    this.maintenanceItems.push(item);
    return item;
  }

  async updateMaintenance(id: number, m: Partial<Maintenance>): Promise<Maintenance | null> {
    const idx = this.maintenanceItems.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.maintenanceItems[idx] = { ...this.maintenanceItems[idx], ...m, version: this.maintenanceItems[idx].version + 1, updatedAt: now() };
    return this.maintenanceItems[idx];
  }

  async deleteMaintenance(id: number): Promise<void> {
    this.maintenanceItems = this.maintenanceItems.filter(m => m.id !== id);
  }

  // ─── Reports ──────────────────────────────────────────────────────────────
  async getPropertyReports(year?: number): Promise<PropertyReport[]> {
    const reports: PropertyReport[] = [];

    for (const property of this.properties) {
      const lease = this.leases.find(l => l.propertyId === property.id && l.status === "פעיל") ?? null;

      const allTx = this.transactions.filter(t => {
        if (t.propertyId !== property.id) return false;
        if (year) {
          const txYear = parseInt(t.date.split("-")[0]);
          if (txYear !== year) return false;
        }
        return true;
      });

      const incomeTransactions = allTx.filter(t => t.type === "income");
      const expenseTransactions = allTx.filter(t => t.type === "expense");

      const maintItems = this.maintenanceItems.filter(m => {
        if (m.propertyId !== property.id) return false;
        if (year) {
          const mYear = parseInt(m.reportedDate.split("-")[0]);
          if (mYear !== year) return false;
        }
        return true;
      });

      const totalIncome = incomeTransactions.reduce((s, t) => s + t.amount, 0);
      const totalMaintenanceCost = maintItems
        .filter(m => m.paidBy === "בעלים" && m.cost)
        .reduce((s, m) => s + (m.cost ?? 0), 0);
      const totalExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0) + totalMaintenanceCost;
      const netProfit = totalIncome - totalExpenses;

      const owners = this.propertyOwners
        .filter(po => po.propertyId === property.id)
        .map(po => {
          const owner = this.owners.find(o => o.id === po.ownerId);
          return {
            ...po,
            ownerName: owner?.name ?? "לא ידוע",
            ownerPhone: owner?.phone ?? null,
            ownerEmail: owner?.email ?? null,
          };
        });

      reports.push({
        property,
        lease,
        monthlyRent: lease?.monthlyRent ?? 0,
        annualRentExpected: (lease?.monthlyRent ?? 0) * 12,
        incomeTransactions,
        expenseTransactions,
        maintenanceItems: maintItems,
        totalIncome,
        totalExpenses,
        totalMaintenanceCost,
        netProfit,
        owners,
      });
    }

    return reports;
  }

  async getOwnerReports(year?: number): Promise<OwnerReport[]> {
    const propertyReports = await this.getPropertyReports(year);
    const reports: OwnerReport[] = [];

    for (const owner of this.owners) {
      const assignments = this.propertyOwners.filter(po => po.ownerId === owner.id);
      const properties: OwnerReport["properties"] = [];

      for (const po of assignments) {
        const pr = propertyReports.find(r => r.property.id === po.propertyId);
        if (!pr) continue;
        const pct = po.ownershipPercent / 100;
        properties.push({
          property: pr.property,
          ownershipPercent: po.ownershipPercent,
          incomeShare: pr.totalIncome * pct,
          expenseShare: pr.totalExpenses * pct,
          netShare: pr.netProfit * pct,
          monthlyRentShare: pr.monthlyRent * pct,
        });
      }

      reports.push({
        owner,
        properties,
        totalIncomeShare: properties.reduce((s, p) => s + p.incomeShare, 0),
        totalExpenseShare: properties.reduce((s, p) => s + p.expenseShare, 0),
        totalNetShare: properties.reduce((s, p) => s + p.netShare, 0),
        totalMonthlyRentShare: properties.reduce((s, p) => s + p.monthlyRentShare, 0),
      });
    }

    return reports;
  }

  // ─── Sync ────────────────────────────────────────────────────────────────

  async exportSnapshot(): Promise<SyncPayload> {
    return {
      exportedAt: now(),
      strategy: "last_write_wins",
      properties: [...this.properties],
      owners: [...this.owners],
      transactions: [...this.transactions],
    };
  }

  async importSync(payload: SyncPayload): Promise<SyncResult> {
    const { strategy } = payload;
    const result: SyncResult = {
      strategy,
      created: { properties: 0, owners: 0, transactions: 0 },
      updated: { properties: 0, owners: 0, transactions: 0 },
      skipped: { properties: 0, owners: 0, transactions: 0 },
      conflicts: [],
      exportedAt: payload.exportedAt,
    };

    // ── Process a single entity type ──────────────────────────────────────
    const processEntities = <T extends { id: number; version: number; updatedAt: string }>(
      incoming: T[],
      localArray: T[],
      entityType: SyncEntityType,
      setLocalArray: (arr: T[]) => void,
      nextId: () => number,
      countKey: "properties" | "owners" | "transactions"
    ) => {
      const localMap = new Map(localArray.map(r => [r.id, r]));

      for (const inc of incoming) {
        const local = localMap.get(inc.id);

        if (!local) {
          // New record — always create
          localArray.push(inc);
          result.created[countKey]++;
          continue;
        }

        // Same version + same updatedAt → identical, skip
        if (local.version === inc.version && local.updatedAt === inc.updatedAt) {
          result.skipped[countKey]++;
          continue;
        }

        if (strategy === "manual") {
          // Surface conflict, don't touch local
          result.conflicts.push({
            id: inc.id,
            entityType,
            local: toSyncRecord(entityType, local as unknown as Property | Owner | Transaction),
            incoming: toSyncRecord(entityType, inc as unknown as Property | Owner | Transaction),
          });
          result.skipped[countKey]++;
          continue;
        }

        const overwrite = shouldOverwrite(local, inc, strategy);
        if (overwrite) {
          const idx = localArray.findIndex(r => r.id === inc.id);
          if (idx !== -1) localArray[idx] = inc;
          result.updated[countKey]++;
        } else {
          result.skipped[countKey]++;
        }
      }

      setLocalArray(localArray);
    };

    processEntities(
      payload.properties, this.properties, "properties",
      (arr) => { this.properties = arr; }, () => this.propId++, "properties"
    );
    processEntities(
      payload.owners, this.owners, "owners",
      (arr) => { this.owners = arr; }, () => this.ownId++, "owners"
    );
    processEntities(
      payload.transactions, this.transactions, "transactions",
      (arr) => { this.transactions = arr; }, () => this.txId++, "transactions"
    );

    // Record in history
    const total = result.created;
    const upd = result.updated;
    const skip = result.skipped;
    this.syncHistory.unshift({
      id: this.syncHistoryId++,
      syncedAt: now(),
      strategy,
      created: total.properties + total.owners + total.transactions,
      updated: upd.properties + upd.owners + upd.transactions,
      skipped: skip.properties + skip.owners + skip.transactions,
      conflicts: result.conflicts.length,
      source: payload.exportedAt,
    });

    return result;
  }

  async getSyncHistory(): Promise<SyncHistoryEntry[]> {
    return [...this.syncHistory];
  }
}

import { DatabaseStorage } from "./dbStorage";
export const storage: IStorage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
