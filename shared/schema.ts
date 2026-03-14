import { pgTable, text, integer, real, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Properties table
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  type: text("type").notNull(),
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(""),
});

// Owners table
export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  idNumber: text("id_number"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(""),
});

// Property-Owner assignments (many-to-many with ownership %)
export const propertyOwners = pgTable("property_owners", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  ownershipPercent: real("ownership_percent").notNull().default(100),
  startDate: text("start_date"),
  notes: text("notes"),
});

// Transactions (income + expense)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  type: text("type").notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  paymentStatus: text("payment_status").notNull().default("שולם"),
  expenseType: text("expense_type"),
  collectionMethod: text("collection_method"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  createdAt: text("created_at").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(""),
});

// Lease contracts — the authoritative source for rental income
export const leases = pgTable("leases", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  tenantName: text("tenant_name").notNull(),
  tenantPhone: text("tenant_phone"),
  tenantEmail: text("tenant_email"),
  tenantId: text("tenant_id"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  monthlyRent: real("monthly_rent").notNull(),
  depositAmount: real("deposit_amount"),
  paymentDayOfMonth: integer("payment_day_of_month").notNull().default(1),
  status: text("status").notNull().default("פעיל"), // פעיל | הסתיים | עתידי
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(""),
});

// Maintenance & fault tickets — source for maintenance expenses
export const maintenance = pgTable("maintenance", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // אינסטלציה | חשמל | מזגן | בנייה | ריהוט | אחר
  status: text("status").notNull().default("פתוח"), // פתוח | בטיפול | סגור
  reportedDate: text("reported_date").notNull(),
  resolvedDate: text("resolved_date"),
  cost: real("cost"),
  paidBy: text("paid_by").notNull().default("בעלים"), // בעלים | שוכר
  contractor: text("contractor"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  notes: text("notes"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(""),
});

// ─── Insert Schemas & Types ──────────────────────────────────────────────────
export const insertLeaseSchema = createInsertSchema(leases).omit({ id: true, version: true, updatedAt: true });
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Lease = typeof leases.$inferSelect;

export const insertMaintenanceSchema = createInsertSchema(maintenance).omit({ id: true, version: true, updatedAt: true });
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type Maintenance = typeof maintenance.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, version: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, version: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export const insertOwnerSchema = createInsertSchema(owners).omit({ id: true, version: true, updatedAt: true });
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof owners.$inferSelect;

export const insertPropertyOwnerSchema = createInsertSchema(propertyOwners).omit({ id: true });
export type InsertPropertyOwner = z.infer<typeof insertPropertyOwnerSchema>;
export type PropertyOwner = typeof propertyOwners.$inferSelect;

// ─── Extended types ─────────────────────────────────────────────────────────
export type PropertyOwnerWithDetails = PropertyOwner & {
  ownerName: string;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
};

export type PropertyWithOwners = Property & {
  owners: PropertyOwnerWithDetails[];
};

// ─── Report types (derived — computed from source-of-truth tables) ───────────────────

/** Report line for a single property — P&L from all data sources */
export interface PropertyReport {
  property: Property;
  lease: Lease | null;                    // Source: leases table
  monthlyRent: number;                    // ← leases.monthlyRent
  annualRentExpected: number;             // ← leases.monthlyRent × 12
  incomeTransactions: Transaction[];      // ← transactions (income)
  expenseTransactions: Transaction[];     // ← transactions (expense)
  maintenanceItems: Maintenance[];        // ← maintenance table
  totalIncome: number;                    // sum of income transactions
  totalExpenses: number;                  // sum of expenses + maintenance costs
  totalMaintenanceCost: number;           // sum of maintenance costs (paid by owners)
  netProfit: number;                      // totalIncome - totalExpenses
  owners: PropertyOwnerWithDetails[];     // ← propertyOwners table
}

/** Report line for a single owner — their share across all properties */
export interface OwnerReport {
  owner: Owner;
  properties: {
    property: Property;
    ownershipPercent: number;             // ← propertyOwners.ownershipPercent
    incomeShare: number;                  // totalIncome × ownershipPercent/100
    expenseShare: number;                 // totalExpenses × ownershipPercent/100
    netShare: number;                     // netProfit × ownershipPercent/100
    monthlyRentShare: number;             // monthlyRent × ownershipPercent/100
  }[];
  totalIncomeShare: number;               // sum across all properties
  totalExpenseShare: number;
  totalNetShare: number;
  totalMonthlyRentShare: number;
}

// ─── Sync types ─────────────────────────────────────────────────────────────

/** How to resolve a conflict between local and incoming record */
export type SyncStrategy =
  | "last_write_wins"   // newest updatedAt wins
  | "highest_version"   // highest version number wins
  | "local_wins"        // local record always wins (ignore incoming)
  | "incoming_wins"     // incoming record always wins (overwrite local)
  | "manual";           // surface conflict to user for manual resolution

export type SyncEntityType = "properties" | "owners" | "transactions";

export interface SyncRecord {
  id: number;
  entityType: SyncEntityType;
  version: number;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface SyncConflict {
  id: number;
  entityType: SyncEntityType;
  local: SyncRecord;
  incoming: SyncRecord;
  resolvedWith?: "local" | "incoming";
}

export interface SyncPayload {
  exportedAt: string;
  strategy: SyncStrategy;
  properties: Property[];
  owners: Owner[];
  transactions: Transaction[];
}

export interface SyncResult {
  strategy: SyncStrategy;
  created: { properties: number; owners: number; transactions: number };
  updated: { properties: number; owners: number; transactions: number };
  skipped: { properties: number; owners: number; transactions: number };
  conflicts: SyncConflict[];
  exportedAt: string;
}
