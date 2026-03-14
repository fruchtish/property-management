import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Running migrations...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS owners (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      id_number TEXT,
      bank_account TEXT,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS property_owners (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      ownership_percent REAL NOT NULL DEFAULT 100,
      start_date TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      payment_status TEXT NOT NULL DEFAULT 'שולם',
      expense_type TEXT,
      collection_method TEXT,
      file_url TEXT,
      file_name TEXT,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS leases (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      tenant_name TEXT NOT NULL,
      tenant_phone TEXT,
      tenant_email TEXT,
      tenant_id TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      monthly_rent REAL NOT NULL,
      deposit_amount REAL,
      payment_day_of_month INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'פעיל',
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS maintenance (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'פתוח',
      reported_date TEXT NOT NULL,
      resolved_date TEXT,
      cost REAL,
      paid_by TEXT NOT NULL DEFAULT 'בעלים',
      contractor TEXT,
      file_url TEXT,
      file_name TEXT,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT ''
    );
  `);

  console.log("✓ Tables created successfully");

  // Seed initial data if tables are empty
  const existingProps = await db.execute(sql`SELECT COUNT(*) as count FROM properties`);
  const count = Number((existingProps.rows[0] as any).count);

  if (count === 0) {
    console.log("Seeding initial data...");
    const ts = new Date().toISOString();
    const today = new Date();
    const m = (months: number) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - months);
      return d.toISOString().split("T")[0];
    };

    await db.execute(sql`
      INSERT INTO properties (code, name, address, city, type, version, updated_at) VALUES
        ('P001', 'דירת הירקון', 'הירקון 45', 'תל אביב', 'דירת מגורים', 1, ${ts}),
        ('P002', 'משרד רמת החיל', 'דרך השלום 78', 'תל אביב', 'משרד', 1, ${ts}),
        ('P003', 'וילה הרצליה', 'בן גוריון 12', 'הרצליה', 'וילה', 1, ${ts}),
        ('P004', 'דירה נתניה', 'הרצל 33', 'נתניה', 'דירת מגורים', 1, ${ts});

      INSERT INTO owners (code, name, phone, email, id_number, bank_account, version, updated_at) VALUES
        ('O001', 'דוד כהן', '050-1234567', 'david@gmail.com', '123456789', '12-345-678901', 1, ${ts}),
        ('O002', 'שרה לוי', '052-9876543', 'sara@gmail.com', '987654321', '11-222-333444', 1, ${ts}),
        ('O003', 'יוסי מזרחי', '054-4567891', 'yossi@gmail.com', '456789123', '10-111-222333', 1, ${ts});

      INSERT INTO property_owners (property_id, owner_id, ownership_percent, start_date) VALUES
        (1, 1, 100, '2023-01-01'),
        (2, 1, 50, '2022-06-01'),
        (2, 2, 50, '2022-06-01'),
        (3, 2, 60, '2021-01-01'),
        (3, 3, 40, '2021-01-01'),
        (4, 3, 100, '2024-03-01');

      INSERT INTO leases (property_id, tenant_name, tenant_phone, tenant_email, tenant_id, start_date, end_date, monthly_rent, deposit_amount, payment_day_of_month, status, version, updated_at) VALUES
        (1, 'יועד כהן', '054-1111111', 'yoav@email.com', '111111111', '2024-01-01', '2026-12-31', 7200, 14400, 1, 'פעיל', 1, ${ts}),
        (2, 'חברת טכנולוגיה בעמ', '03-5555555', 'office@tech.co.il', '555555555', '2022-06-01', '2027-05-31', 14000, 42000, 5, 'פעיל', 1, ${ts}),
        (3, 'משפחת לוי', '052-2222222', 'levi@gmail.com', '222222222', '2023-07-01', '2025-06-30', 22000, 44000, 1, 'פעיל', 1, ${ts}),
        (4, 'אבי נחמן', '050-3333333', 'avi@email.com', '333333333', '2024-04-01', '2026-03-31', 5800, 11600, 3, 'פעיל', 1, ${ts});
    `);

    await db.execute(sql`
      INSERT INTO transactions (property_id, type, date, amount, category, description, payment_status, collection_method, created_at, version, updated_at) VALUES
        (1, 'income', ${m(0)}, 7200, 'שכירות', 'שכירות חודשית', 'שולם', 'העברה בנקאית', ${m(0)}, 1, ${ts}),
        (2, 'income', ${m(0)}, 14000, 'שכירות', 'שכירות חודשית', 'שולם', 'העברה בנקאית', ${m(0)}, 1, ${ts}),
        (3, 'income', ${m(0)}, 22000, 'שכירות', 'שכירות חודשית', 'שולם', 'שיק', ${m(0)}, 1, ${ts}),
        (1, 'income', ${m(1)}, 7200, 'שכירות', 'שכירות חודשית', 'שולם', 'העברה בנקאית', ${m(1)}, 1, ${ts}),
        (1, 'expense', ${m(0)}, 1000, 'ארנונה', 'ארנונה חודשית', 'שולם', 'מזומן', ${m(0)}, 1, ${ts}),
        (1, 'expense', ${m(0)}, 500, 'ועד בית', 'ועד בית חודשי', 'שולם', 'שיק', ${m(0)}, 1, ${ts}),
        (2, 'expense', ${m(0)}, 2500, 'תיקון/תחזוקה', 'תיקון מזגן', 'שולם', 'מזומן', ${m(0)}, 1, ${ts}),
        (3, 'expense', ${m(1)}, 5500, 'תיקון/תחזוקה', 'תיקון גדר', 'שולם', 'העברה בנקאית', ${m(1)}, 1, ${ts}),
        (1, 'expense', ${m(0)}, 2500, 'עורך דין', 'עריכת חוזה שכירות', 'שולם', 'העברה בנקאית', ${m(0)}, 1, ${ts}),
        (2, 'income', ${m(1)}, 14000, 'שכירות', 'שכירות חודשית', 'שולם', 'העברה בנקאית', ${m(1)}, 1, ${ts});

      INSERT INTO maintenance (property_id, title, description, category, status, reported_date, resolved_date, cost, paid_by, contractor, version, updated_at) VALUES
        (2, 'תיקון מזגן', 'חלפת קומפרסור', 'מזגן', 'סגור', ${m(2)}, ${m(1)}, 2500, 'בעלים', 'קרמני אירוג', 1, ${ts}),
        (3, 'תיקון גדר', 'סדק בגדר החיצוני', 'בנייה', 'סגור', ${m(3)}, ${m(2)}, 5500, 'בעלים', 'בניין ישראלי', 1, ${ts}),
        (1, 'ריבוץ דלת', 'דלת יציאה סדוקה', 'בנייה', 'בטיפול', ${m(0)}, NULL, 1200, 'בעלים', NULL, 1, ${ts}),
        (4, 'תקלה חשמל', 'הפסקת חשמל בסלון', 'חשמל', 'פתוח', ${m(0)}, NULL, NULL, 'בעלים', NULL, 1, ${ts});
    `);

    console.log("✓ Seed data inserted");
  }

  await pool.end();
  console.log("✓ Migration complete");
}

migrate().catch(console.error);
