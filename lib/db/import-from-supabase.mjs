/**
 * One-time data import: pulls menu_items, store_settings, delivery_settings
 * from the old Supabase project and inserts them into Replit Postgres.
 * Run once with: node lib/db/import-from-supabase.mjs
 */
import pg from "pg";

const SUPA_URL = "https://arkcpveujkddkxqekueg.supabase.co";
const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFya2NwdmV1amtkZGt4cWVrdWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTI4MDgsImV4cCI6MjA5NDc4ODgwOH0.JJesMeU-h33uwlJfjcHQwczNjRe7VTJrGWjuU8S_GHk";

const { Pool, types } = pg;
types.setTypeParser(1700, parseFloat);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fetchTable(table) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=*&limit=500`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log("Connecting to Replit Postgres…");
  await pool.query("SELECT 1");

  // ── menu_items ──────────────────────────────────────────────────────────
  console.log("\nFetching menu_items from Supabase…");
  const menuItems = await fetchTable("menu_items");
  console.log(`  Got ${menuItems.length} rows`);

  let menuImported = 0;
  for (const item of menuItems) {
    await pool.query(
      `INSERT INTO "menu_items"
         (id, name, description, price, category, available, sort_order, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         category = EXCLUDED.category,
         available = EXCLUDED.available,
         sort_order = EXCLUDED.sort_order,
         image_url = EXCLUDED.image_url,
         updated_at = NOW()`,
      [
        item.id,
        item.name ?? "",
        item.description ?? "",
        item.price ?? 0,
        item.category ?? "",
        item.available !== false,
        item.sort_order ?? 0,
        item.image_url ?? "",
      ],
    );
    menuImported++;
  }
  console.log(`  Imported ${menuImported} menu items ✓`);

  // ── store_settings ──────────────────────────────────────────────────────
  console.log("\nFetching store_settings from Supabase…");
  const storeRows = await fetchTable("store_settings");
  console.log(`  Got ${storeRows.length} rows`);

  for (const row of storeRows) {
    await pool.query(
      `INSERT INTO "store_settings" (id, store_open, singleton_key)
       VALUES ($1,$2,$3)
       ON CONFLICT (singleton_key) DO UPDATE SET
         store_open = EXCLUDED.store_open,
         updated_at = NOW()`,
      [row.id, row.store_open !== false, "main"],
    );
  }
  if (storeRows.length === 0) {
    // Ensure a default row exists
    await pool.query(
      `INSERT INTO "store_settings" (store_open, singleton_key)
       VALUES (true, 'main')
       ON CONFLICT (singleton_key) DO NOTHING`,
    );
    console.log("  No rows in Supabase — inserted default (store_open=true) ✓");
  } else {
    console.log(`  Imported ${storeRows.length} store_settings rows ✓`);
  }

  // ── delivery_settings ───────────────────────────────────────────────────
  console.log("\nFetching delivery_settings from Supabase…");
  const deliveryRows = await fetchTable("delivery_settings");
  console.log(`  Got ${deliveryRows.length} rows`);

  for (const row of deliveryRows) {
    await pool.query(
      `INSERT INTO "delivery_settings"
         (id, mode, manual_active, schedule, pickup_active, singleton_key)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (singleton_key) DO UPDATE SET
         mode = EXCLUDED.mode,
         manual_active = EXCLUDED.manual_active,
         schedule = EXCLUDED.schedule,
         pickup_active = EXCLUDED.pickup_active,
         updated_at = NOW()`,
      [
        row.id,
        row.mode ?? "manual",
        row.manual_active !== false,
        row.schedule != null ? JSON.stringify(row.schedule) : "{}",
        row.pickup_active !== false,
        "main",
      ],
    );
  }
  if (deliveryRows.length === 0) {
    await pool.query(
      `INSERT INTO "delivery_settings" (mode, manual_active, pickup_active, singleton_key)
       VALUES ('manual', true, true, 'main')
       ON CONFLICT (singleton_key) DO NOTHING`,
    );
    console.log("  No rows in Supabase — inserted defaults ✓");
  } else {
    console.log(`  Imported ${deliveryRows.length} delivery_settings rows ✓`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const [m, s, d] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM "menu_items"'),
    pool.query('SELECT store_open FROM "store_settings" WHERE singleton_key=\'main\''),
    pool.query('SELECT manual_active, pickup_active FROM "delivery_settings" WHERE singleton_key=\'main\''),
  ]);
  console.log("\n── Replit Postgres state after import ──────────────────────");
  console.log(`  menu_items:       ${m.rows[0].count} rows`);
  console.log(`  store_settings:   store_open=${s.rows[0]?.store_open}`);
  console.log(`  delivery_settings: manual_active=${d.rows[0]?.manual_active}, pickup_active=${d.rows[0]?.pickup_active}`);
  console.log("\nDone ✓");
  await pool.end();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
