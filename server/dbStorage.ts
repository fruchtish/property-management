import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  properties, owners, propertyOwners, transactions, leases, maintenance,
  Property, InsertProperty,
  Owner, InsertOwner,
  PropertyOwner, InsertPropertyOwner, PropertyOwnerWithDetails, PropertyWithOwners,
  Transaction, InsertTransaction,
  Lease, InsertLease,
  Maintenance, InsertMaintenance,
  PropertyReport, OwnerReport,
  SyncPayload, SyncResult, SyncConflict, SyncStrategy, SyncRecord, SyncEntityType,
} from "@shared/schema";
import { IStorage, SyncHistoryEntry } from "./storage";

const now = () => new Date().toISOString();

function shouldOverwrite(
  local: { version: number; updatedAt: string },
  incoming: { version: number; updatedAt: string },
  strategy: SyncStrategy
): boolean {
  switch (strategy) {
    case "last_write_wins": return incoming.updatedAt > local.updatedAt;
    case "highest_version": return incoming.version > local.version;
    case "local_wins": return false;
    case "incoming_wins": return true;
    case "manual": return false;
    default: return false;
  }
}

function toSyncRecord(entityType: SyncEntityType, rec: Property | Owner | Transaction): SyncRecord {
  return { id: rec.id, entityType, version: rec.version, updatedAt: rec.updatedAt, data: rec as Record<string, unknown> };
}

export class DatabaseStorage implements IStorage {

  // ─── Transactions ────────────────────────────────────────────────────────
  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(transactions.id);
  }

  async getTransactionsByProperty(propertyId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.propertyId, propertyId));
  }

  async createTransaction(t: InsertTransaction & { createdAt: string; fileUrl?: string | null; fileName?: string | null }): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values({
      ...t,
      version: 1,
      updatedAt: now(),
    }).returning();
    return tx;
  }

  async updateTransaction(id: number, t: Partial<Transaction>): Promise<Transaction | null> {
    const existing = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!existing[0]) return null;
    const [updated] = await db.update(transactions)
      .set({ ...t, version: existing[0].version + 1, updatedAt: now() })
      .where(eq(transactions.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  // ─── Properties ──────────────────────────────────────────────────────────
  async getProperties(): Promise<Property[]> {
    return db.select().from(properties).orderBy(properties.id);
  }

  async getPropertiesWithOwners(): Promise<PropertyWithOwners[]> {
    const props = await this.getProperties();
    const allPO = await db.select().from(propertyOwners);
    const allOwners = await db.select().from(owners);

    return props.map(prop => ({
      ...prop,
      owners: allPO
        .filter(po => po.propertyId === prop.id)
        .map(po => {
          const owner = allOwners.find(o => o.id === po.ownerId);
          return { ...po, ownerName: owner?.name ?? "לא ידוע", ownerPhone: owner?.phone ?? null, ownerEmail: owner?.email ?? null };
        }),
    }));
  }

  async createProperty(p: InsertProperty): Promise<Property> {
    const existing = await this.getProperties();
    const nextCode = p.code || `P${String(existing.length + 1).padStart(3, "0")}`;
    const [prop] = await db.insert(properties).values({ ...p, code: nextCode, version: 1, updatedAt: now() }).returning();
    return prop;
  }

  async updateProperty(id: number, p: Partial<InsertProperty>): Promise<Property | null> {
    const existing = await db.select().from(properties).where(eq(properties.id, id));
    if (!existing[0]) return null;
    const [updated] = await db.update(properties)
      .set({ ...p, version: existing[0].version + 1, updatedAt: now() })
      .where(eq(properties.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteProperty(id: number): Promise<void> {
    await db.delete(propertyOwners).where(eq(propertyOwners.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
  }

  // ─── Owners ──────────────────────────────────────────────────────────────
  async getOwners(): Promise<Owner[]> {
    return db.select().from(owners).orderBy(owners.id);
  }

  async createOwner(o: InsertOwner): Promise<Owner> {
    const existing = await this.getOwners();
    const nextCode = o.code || `O${String(existing.length + 1).padStart(3, "0")}`;
    const [owner] = await db.insert(owners).values({ ...o, code: nextCode, version: 1, updatedAt: now() }).returning();
    return owner;
  }

  async updateOwner(id: number, o: Partial<InsertOwner>): Promise<Owner | null> {
    const existing = await db.select().from(owners).where(eq(owners.id, id));
    if (!existing[0]) return null;
    const [updated] = await db.update(owners)
      .set({ ...o, version: existing[0].version + 1, updatedAt: now() })
      .where(eq(owners.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteOwner(id: number): Promise<void> {
    await db.delete(propertyOwners).where(eq(propertyOwners.ownerId, id));
    await db.delete(owners).where(eq(owners.id, id));
  }

  // ─── Property-Owner Assignments ──────────────────────────────────────────
  async getPropertyOwners(propertyId: number): Promise<PropertyOwnerWithDetails[]> {
    const pos = await db.select().from(propertyOwners).where(eq(propertyOwners.propertyId, propertyId));
    const allOwners = await db.select().from(owners);
    return pos.map(po => {
      const owner = allOwners.find(o => o.id === po.ownerId);
      return { ...po, ownerName: owner?.name ?? "לא ידוע", ownerPhone: owner?.phone ?? null, ownerEmail: owner?.email ?? null };
    });
  }

  async getAllPropertyOwners(): Promise<PropertyOwner[]> {
    return db.select().from(propertyOwners);
  }

  async createPropertyOwner(po: InsertPropertyOwner): Promise<PropertyOwner> {
    const [item] = await db.insert(propertyOwners).values(po).returning();
    return item;
  }

  async updatePropertyOwner(id: number, po: Partial<InsertPropertyOwner>): Promise<PropertyOwner | null> {
    const [updated] = await db.update(propertyOwners).set(po).where(eq(propertyOwners.id, id)).returning();
    return updated ?? null;
  }

  async deletePropertyOwner(id: number): Promise<void> {
    await db.delete(propertyOwners).where(eq(propertyOwners.id, id));
  }

  // ─── Leases ──────────────────────────────────────────────────────────────
  async getLeases(): Promise<Lease[]> {
    return db.select().from(leases).orderBy(leases.id);
  }

  async getLeasesByProperty(propertyId: number): Promise<Lease[]> {
    return db.select().from(leases).where(eq(leases.propertyId, propertyId));
  }

  async getActiveLease(propertyId: number): Promise<Lease | null> {
    const result = await db.select().from(leases).where(
      and(eq(leases.propertyId, propertyId), eq(leases.status, "פעיל"))
    );
    return result[0] ?? null;
  }

  async createLease(l: InsertLease): Promise<Lease> {
    const [lease] = await db.insert(leases).values({ ...l, version: 1, updatedAt: now() }).returning();
    return lease;
  }

  async updateLease(id: number, l: Partial<InsertLease>): Promise<Lease | null> {
    const existing = await db.select().from(leases).where(eq(leases.id, id));
    if (!existing[0]) return null;
    const [updated] = await db.update(leases)
      .set({ ...l, version: existing[0].version + 1, updatedAt: now() })
      .where(eq(leases.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteLease(id: number): Promise<void> {
    await db.delete(leases).where(eq(leases.id, id));
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────
  async getMaintenance(): Promise<Maintenance[]> {
    return db.select().from(maintenance).orderBy(maintenance.id);
  }

  async getMaintenanceByProperty(propertyId: number): Promise<Maintenance[]> {
    return db.select().from(maintenance).where(eq(maintenance.propertyId, propertyId));
  }

  async createMaintenance(m: InsertMaintenance & { fileUrl?: string | null; fileName?: string | null }): Promise<Maintenance> {
    const [item] = await db.insert(maintenance).values({ ...m, version: 1, updatedAt: now() }).returning();
    return item;
  }

  async updateMaintenance(id: number, m: Partial<Maintenance>): Promise<Maintenance | null> {
    const existing = await db.select().from(maintenance).where(eq(maintenance.id, id));
    if (!existing[0]) return null;
    const [updated] = await db.update(maintenance)
      .set({ ...m, version: existing[0].version + 1, updatedAt: now() })
      .where(eq(maintenance.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteMaintenance(id: number): Promise<void> {
    await db.delete(maintenance).where(eq(maintenance.id, id));
  }

  // ─── Reports ─────────────────────────────────────────────────────────────
  async getPropertyReports(year?: number): Promise<PropertyReport[]> {
    const reports: PropertyReport[] = [];
    const allProps = await this.getProperties();
    const allLeases = await this.getLeases();
    const allTx = await this.getTransactions();
    const allMaint = await this.getMaintenance();
    const allPO = await this.getAllPropertyOwners();
    const allOwners = await this.getOwners();

    for (const property of allProps) {
      const lease = allLeases.find(l => l.propertyId === property.id && l.status === "פעיל") ?? null;

      const propTx = allTx.filter(t => {
        if (t.propertyId !== property.id) return false;
        if (year) return parseInt(t.date.split("-")[0]) === year;
        return true;
      });

      const propMaint = allMaint.filter(m => {
        if (m.propertyId !== property.id) return false;
        if (year) return parseInt(m.reportedDate.split("-")[0]) === year;
        return true;
      });

      const incomeTransactions = propTx.filter(t => t.type === "income");
      const expenseTransactions = propTx.filter(t => t.type === "expense");
      const totalIncome = incomeTransactions.reduce((s, t) => s + t.amount, 0);
      const totalMaintenanceCost = propMaint.filter(m => m.paidBy === "בעלים" && m.cost).reduce((s, m) => s + (m.cost ?? 0), 0);
      const totalExpenses = expenseTransactions.reduce((s, t) => s + t.amount, 0) + totalMaintenanceCost;

      const propOwners = allPO.filter(po => po.propertyId === property.id).map(po => {
        const owner = allOwners.find(o => o.id === po.ownerId);
        return { ...po, ownerName: owner?.name ?? "לא ידוע", ownerPhone: owner?.phone ?? null, ownerEmail: owner?.email ?? null };
      });

      reports.push({
        property, lease,
        monthlyRent: lease?.monthlyRent ?? 0,
        annualRentExpected: (lease?.monthlyRent ?? 0) * 12,
        incomeTransactions, expenseTransactions,
        maintenanceItems: propMaint,
        totalIncome, totalExpenses, totalMaintenanceCost,
        netProfit: totalIncome - totalExpenses,
        owners: propOwners,
      });
    }
    return reports;
  }

  async getOwnerReports(year?: number): Promise<OwnerReport[]> {
    const propertyReports = await this.getPropertyReports(year);
    const allOwners = await this.getOwners();
    const allPO = await this.getAllPropertyOwners();

    return allOwners.map(owner => {
      const assignments = allPO.filter(po => po.ownerId === owner.id);
      const ownerProperties = assignments.map(po => {
        const pr = propertyReports.find(r => r.property.id === po.propertyId);
        if (!pr) return null;
        const pct = po.ownershipPercent / 100;
        return {
          property: pr.property,
          ownershipPercent: po.ownershipPercent,
          incomeShare: pr.totalIncome * pct,
          expenseShare: pr.totalExpenses * pct,
          netShare: pr.netProfit * pct,
          monthlyRentShare: pr.monthlyRent * pct,
        };
      }).filter(Boolean) as OwnerReport["properties"];

      return {
        owner,
        properties: ownerProperties,
        totalIncomeShare: ownerProperties.reduce((s, p) => s + p.incomeShare, 0),
        totalExpenseShare: ownerProperties.reduce((s, p) => s + p.expenseShare, 0),
        totalNetShare: ownerProperties.reduce((s, p) => s + p.netShare, 0),
        totalMonthlyRentShare: ownerProperties.reduce((s, p) => s + p.monthlyRentShare, 0),
      };
    });
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────
  async exportSnapshot(): Promise<SyncPayload> {
    return {
      exportedAt: now(),
      strategy: "last_write_wins",
      properties: await this.getProperties(),
      owners: await this.getOwners(),
      transactions: await this.getTransactions(),
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

    const processEntities = async <T extends { id: number; version: number; updatedAt: string }>(
      incoming: T[],
      getLocal: () => Promise<T[]>,
      upsert: (item: T, exists: boolean) => Promise<void>,
      countKey: "properties" | "owners" | "transactions",
      entityType: SyncEntityType
    ) => {
      const localArr = await getLocal();
      const localMap = new Map(localArr.map(r => [r.id, r]));
      for (const inc of incoming) {
        const local = localMap.get(inc.id);
        if (!local) {
          await upsert(inc, false);
          result.created[countKey]++;
          continue;
        }
        if (local.version === inc.version && local.updatedAt === inc.updatedAt) {
          result.skipped[countKey]++;
          continue;
        }
        if (strategy === "manual") {
          result.conflicts.push({ id: inc.id, entityType, local: toSyncRecord(entityType, local as any), incoming: toSyncRecord(entityType, inc as any) });
          result.skipped[countKey]++;
          continue;
        }
        if (shouldOverwrite(local, inc, strategy)) {
          await upsert(inc, true);
          result.updated[countKey]++;
        } else {
          result.skipped[countKey]++;
        }
      }
    };

    await processEntities(
      payload.properties,
      () => this.getProperties(),
      async (p, exists) => {
        if (exists) await db.update(properties).set(p).where(eq(properties.id, p.id));
        else await db.insert(properties).values(p);
      },
      "properties", "properties"
    );

    await processEntities(
      payload.owners,
      () => this.getOwners(),
      async (o, exists) => {
        if (exists) await db.update(owners).set(o).where(eq(owners.id, o.id));
        else await db.insert(owners).values(o);
      },
      "owners", "owners"
    );

    await processEntities(
      payload.transactions,
      () => this.getTransactions(),
      async (t, exists) => {
        if (exists) await db.update(transactions).set(t).where(eq(transactions.id, t.id));
        else await db.insert(transactions).values(t);
      },
      "transactions", "transactions"
    );

    return result;
  }

  async getSyncHistory(): Promise<SyncHistoryEntry[]> {
    return [];
  }
}
