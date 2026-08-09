import { Router, type IRouter } from "express";
import * as net from "net";
import { pool } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

// Read from environment so it can be rotated without redeploying.
// Falls back to the default only when the env var is absent (e.g. local dev without secrets).
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "mozzarellayfuego123";
const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;
const ALLOWED_TABLES = new Set([
  "orders",
  "menu_items",
  "store_settings",
  "delivery_settings",
  "reservations",
  "toppings",
]);

/** Validate table name against allow-list */
function vt(t: string): string {
  if (!ALLOWED_TABLES.has(t)) throw new Error(`Table "${t}" not allowed`);
  return t;
}

/** Sanitise a column name (alphanumeric + underscore only) */
function sc(col: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(col))
    throw new Error(`Invalid column: "${col}"`);
  return col;
}

/** Serialize value for pg: objects/arrays become JSON strings */
function ser(v: unknown): unknown {
  return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
}

function calcDeliveryFee(km: number): number {
  if (km <= 4) return 4;
  if (km <= 5) return 5;
  if (km <= 6) return 6;
  if (km <= 7) return 7;
  return 8;
}

// ── Toppings ───────────────────────────────────────────────────────────────
router.get("/toppings", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "toppings" WHERE "available" = true ORDER BY "sort_order" ASC`,
    );
    return res.json({ data: rows });
  } catch (err: any) {
    req.log.error({ err }, "toppings error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Menu items ─────────────────────────────────────────────────────────────
router.get("/menuItems", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "menu_items" WHERE "available" = true ORDER BY "sort_order" ASC LIMIT 200`,
    );
    return res.json({ data: rows });
  } catch (err: any) {
    req.log.error({ err }, "menuItems error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Create order (pay on delivery / pickup) ────────────────────────────────
router.post("/createOrderDirect", async (req, res) => {
  try {
    const {
      items,
      total,
      customer_name,
      customer_phone,
      customer_address,
      delivery_fee,
      tip,
      order_type,
      pickup_time,
      payment_method,
    } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO "orders"
         (customer_name, customer_phone, customer_address, items, total,
          delivery_fee, tip, order_type, pickup_time, payment_method, status, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        customer_name,
        customer_phone,
        customer_address,
        JSON.stringify(items),
        total,
        delivery_fee,
        tip,
        order_type,
        pickup_time,
        payment_method,
        "pending",
        total - delivery_fee - tip,
      ],
    );
    return res.json({ success: true, orderId: rows[0].id });
  } catch (err: any) {
    req.log.error({ err }, "createOrderDirect error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Delivery fee calculation (Google Distance Matrix) ─────────────────────
router.post("/calcularEnvio", async (req, res) => {
  try {
    const { destLat, destLng } = req.body;
    if (!isFinite(destLat) || !isFinite(destLng)) {
      return res
        .status(400)
        .json({ error: "Coordenadas de destino no válidas" });
    }
    const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Configuración de mapas no disponible" });
    }
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${RESTAURANT_LAT},${RESTAURANT_LNG}` +
      `&destinations=${destLat},${destLng}` +
      `&mode=driving&departure_time=now&language=es&region=es&key=${apiKey}`;
    const gRes = await fetch(url);
    const gData = (await gRes.json()) as any;
    if (gData.status !== "OK") {
      return res
        .status(502)
        .json({ error: "No se pudo calcular la distancia" });
    }
    const element = gData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return res.json({ ok: false, reason: "no_route" });
    }
    const km = parseFloat((element.distance.value / 1000).toFixed(2));
    const durationSec = (element.duration_in_traffic || element.duration).value;
    const estimatedMin = Math.round(durationSec / 60) + 15;
    if (km > MAX_DELIVERY_KM) {
      return res.json({ ok: false, reason: "too_far", km });
    }
    return res.json({ ok: true, km, fee: calcDeliveryFee(km), estimatedMin });
  } catch (err: any) {
    req.log.error({ err }, "calcularEnvio error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Cancel order (no online payment — just mark cancelled in DB) ────────────
router.post("/refundOrder", async (req, res) => {
  try {
    const { orderId, adminPassword } = req.body;
    const sessionOk = !!(req as any).session?.adminAuthed;
    if (!sessionOk && adminPassword !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (!orderId) return res.status(400).json({ error: "orderId requerido" });
    const { rowCount } = await pool.query(
      `UPDATE "orders" SET status = 'cancelled', refunded_at = NOW() WHERE id = $1`,
      [orderId],
    );
    if (!rowCount) return res.status(404).json({ error: "Pedido no encontrado" });
    return res.json({ success: true, message: "Pedido cancelado correctamente" });
  } catch (err: any) {
    req.log.error({ err }, "refundOrder error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Projeto task tracker ────────────────────────────────────────────────────
router.get("/projeto/tasks", async (req, res) => {
  try {
    const { rows: tasks } = await pool.query(
      `SELECT * FROM "projeto_tasks" ORDER BY sort_order ASC`,
    );
    const { rows: checklist } = await pool.query(
      `SELECT * FROM "projeto_checklist" ORDER BY sort_order ASC`,
    );
    const data = tasks.map((t) => ({
      ...t,
      checklist: checklist.filter((c) => c.task_id === t.id),
    }));
    return res.json({ data });
  } catch (err: any) {
    req.log.error({ err }, "projeto/tasks error");
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/projeto/tasks/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["a_fazer", "em_andamento", "em_qa", "concluido"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    await pool.query(
      `UPDATE "projeto_tasks" SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, req.params["id"]],
    );
    return res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "projeto/tasks patch error");
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/projeto/checklist/:id", async (req, res) => {
  try {
    const { checked } = req.body;
    await pool.query(
      `UPDATE "projeto_checklist" SET checked = $1, updated_at = NOW() WHERE id = $2`,
      [!!checked, req.params["id"]],
    );
    return res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "projeto/checklist patch error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Generic CRUD proxy (replaces Supabase proxy) ───────────────────────────
// Tables where ALL writes (insert/update/delete) require an admin session.
// Public tables like orders, reservations, and location_updates are intentionally
// excluded so checkout, reservations, and driver-tracking continue to work without auth.
const ADMIN_ONLY_TABLES = new Set([
  "menu_items",
  "store_settings",
  "delivery_settings",
  "toppings",
  "delivery_guys",
  "admin_settings",
]);
const WRITE_ACTIONS = new Set([
  "insert", "update", "upsert",
  "delete", "delete_one", "delete_many", "delete_all",
]);

router.post("/supabaseProxy", async (req, res) => {
  try {
    const {
      action,
      table: rawTable,
      data,
      query,
      id,
      updates,
      ids,
      upsert_column,
    } = req.body;
    const table = vt(rawTable);

    // Only restrict writes to admin-owned tables; public tables (orders, reservations,
    // location_updates, etc.) must remain writable by unauthenticated clients.
    if (WRITE_ACTIONS.has(action) && ADMIN_ONLY_TABLES.has(table) && !requireAdmin(req, res)) return;

    if (action === "insert") {
      const entries = Object.entries(
        (data ?? {}) as Record<string, any>,
      ).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const cols = entries.map(([c]) => `"${sc(c)}"`).join(", ");
      const vals = entries.map(([, v]) => ser(v));
      const phs = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `INSERT INTO "${table}" (${cols}) VALUES (${phs}) RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "update") {
      const upd = (updates ?? {}) as Record<string, any>;
      const entries = Object.entries(upd).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const vals = entries.map(([, v]) => ser(v));
      const sets = entries
        .map(([c], i) => `"${sc(c)}" = $${i + 1}`)
        .join(", ");
      vals.push(id);
      const { rows } = await pool.query(
        `UPDATE "${table}" SET ${sets} WHERE "id" = $${vals.length} RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "upsert") {
      const entries = Object.entries(
        (data ?? {}) as Record<string, any>,
      ).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const cols = entries.map(([c]) => `"${sc(c)}"`).join(", ");
      const vals = entries.map(([, v]) => ser(v));
      const phs = vals.map((_, i) => `$${i + 1}`).join(", ");
      const conflictCol = upsert_column ? `"${sc(upsert_column)}"` : '"id"';
      const updateSets = entries
        .filter(([c]) => c !== (upsert_column || "id"))
        .map(([c]) => `"${sc(c)}" = EXCLUDED."${sc(c)}"`)
        .join(", ");
      const conflictClause = updateSets
        ? `ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSets}`
        : `ON CONFLICT (${conflictCol}) DO NOTHING`;
      const { rows } = await pool.query(
        `INSERT INTO "${table}" (${cols}) VALUES (${phs}) ${conflictClause} RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "select") {
      const q = (query ?? {}) as Record<string, any>;
      const qEntries = Object.entries(q);
      const vals: any[] = [];
      const where = qEntries.length
        ? "WHERE " +
          qEntries
            .map(([c, v]) => {
              vals.push(v);
              return `"${sc(c)}" = $${vals.length}`;
            })
            .join(" AND ")
        : "";
      const { rows } = await pool.query(
        `SELECT * FROM "${table}" ${where} ORDER BY "created_at" DESC LIMIT 200`,
        vals,
      );
      return res.json({ data: rows });
    }

    if (action === "select_one") {
      const q = (query ?? {}) as Record<string, any>;
      const qEntries = Object.entries(q);
      const vals: any[] = [];
      const where = qEntries.length
        ? "WHERE " +
          qEntries
            .map(([c, v]) => {
              vals.push(v);
              return `"${sc(c)}" = $${vals.length}`;
            })
            .join(" AND ")
        : "";
      const { rows } = await pool.query(
        `SELECT * FROM "${table}" ${where} LIMIT 1`,
        vals,
      );
      return res.json({ data: rows[0] ?? null });
    }

    if (action === "delete" || action === "delete_one") {
      await pool.query(`DELETE FROM "${table}" WHERE "id" = $1`, [id]);
      return res.json({ success: true });
    }

    if (action === "delete_many") {
      if (!ids?.length) return res.json({ success: true });
      await pool.query(
        `DELETE FROM "${table}" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
      return res.json({ success: true });
    }

    if (action === "delete_all") {
      await pool.query(`DELETE FROM "${table}"`);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    req.log.error({ err }, "supabaseProxy error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin session auth ──────────────────────────────────────────────────────
router.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  req.session.adminAuthed = true;
  return res.json({ success: true });
});

router.get('/admin/me', (req, res) => {
  return res.json({ authed: !!req.session.adminAuthed });
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {});
  return res.json({ success: true });
});

// ── Admin: Delivery Guys CRUD ──────────────────────────────────────────────
function requireAdmin(req: any, res: any): boolean {
  // Primary auth: established server session (set by POST /api/admin/login).
  // Backward compat: still accept x-admin-password header so existing integrations
  // don't break while the session migration rolls out.
  const sessionOk = !!req.session?.adminAuthed;
  const pw = req.headers['x-admin-password'];
  if (!sessionOk && pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

router.get('/admin/deliveryGuys', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { rows } = await pool.query(
      `SELECT * FROM "delivery_guys" ORDER BY "name" ASC`,
    );
    return res.json({ data: rows });
  } catch (err: any) {
    req.log.error({ err }, 'deliveryGuys GET error');
    return res.status(500).json({ error: err.message });
  }
});

router.post('/admin/deliveryGuys', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name y phone son requeridos' });
    const { rows } = await pool.query(
      `INSERT INTO "delivery_guys" (name, phone) VALUES ($1, $2) RETURNING *`,
      [name.trim(), phone.trim()],
    );
    return res.json({ data: rows[0] });
  } catch (err: any) {
    req.log.error({ err }, 'deliveryGuys POST error');
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/admin/deliveryGuys/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { name, phone, active } = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    if (name !== undefined) { sets.push(`"name" = $${vals.length + 1}`); vals.push(name.trim()); }
    if (phone !== undefined) { sets.push(`"phone" = $${vals.length + 1}`); vals.push(phone.trim()); }
    if (active !== undefined) { sets.push(`"active" = $${vals.length + 1}`); vals.push(!!active); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    sets.push(`"updated_at" = NOW()`);
    vals.push(req.params['id']);
    const { rows } = await pool.query(
      `UPDATE "delivery_guys" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
      vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Repartidor no encontrado' });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    req.log.error({ err }, 'deliveryGuys PATCH error');
    return res.status(500).json({ error: err.message });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.delete('/admin/deliveryGuys/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    // Unassign from orders before deleting
    await pool.query(
      `UPDATE "orders" SET "assigned_driver_id" = NULL WHERE "assigned_driver_id" = $1`,
      [req.params['id']],
    );
    const { rowCount } = await pool.query(
      `DELETE FROM "delivery_guys" WHERE "id" = $1`,
      [req.params['id']],
    );
    if (!rowCount) return res.status(404).json({ error: 'Repartidor no encontrado' });
    return res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, 'deliveryGuys DELETE error');
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/admin/orders/:id/assignDriver', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const driverId: string | null = req.body.driver_id ?? null;

    // Validate driver if provided
    if (driverId !== null) {
      if (!UUID_RE.test(driverId)) {
        return res.status(400).json({ error: 'driver_id no es un UUID válido' });
      }
      const { rows: driverRows } = await pool.query(
        `SELECT id, active FROM "delivery_guys" WHERE id = $1`,
        [driverId],
      );
      if (!driverRows.length) {
        return res.status(404).json({ error: 'Repartidor no encontrado' });
      }
      if (!driverRows[0].active) {
        return res.status(400).json({ error: 'El repartidor no está activo' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE "orders" SET "assigned_driver_id" = $1 WHERE "id" = $2 RETURNING *`,
      [driverId, req.params['id']],
    );
    if (!rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    req.log.error({ err }, 'assignDriver error');
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin settings ─────────────────────────────────────────────────────────
router.post("/adminSettings", async (req, res) => {
  try {
    const {
      action,
      password,
      key,
      value,
      table: rawTable,
      data,
      query,
      id,
      updates,
      ids,
      upsert_column,
    } = req.body;

    // ── Public reads (no auth required) ─────────────────────────────────────
    if (action === "getPublicSettings") {
      const [storeRes, deliveryRes] = await Promise.all([
        pool.query(
          `SELECT "store_open" FROM "store_settings" LIMIT 1`,
        ),
        pool.query(
          `SELECT "manual_active", "pickup_active" FROM "delivery_settings" LIMIT 1`,
        ),
      ]);
      const storeOpen = storeRes.rows[0]?.store_open !== false;
      const deliveryActive = deliveryRes.rows[0]?.manual_active !== false;
      const pickupActive = deliveryRes.rows[0]?.pickup_active !== false;
      return res.json({ data: { storeOpen, deliveryActive, pickupActive } });
    }

    if (action === "getDeliverySettings") {
      const { rows } = await pool.query(
        `SELECT * FROM "delivery_settings" LIMIT 1`,
      );
      return res.json({ data: rows[0] ?? null });
    }

    // ── Auth required for all mutations ─────────────────────────────────────
    const sessionAuthed = !!(req as any).session?.adminAuthed;
    if (!sessionAuthed && password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (action === "updateSetting") {
      const val = value === true || value === "true";
      if (key === "store_open") {
        await pool.query(
          `INSERT INTO "store_settings" (store_open, singleton_key, updated_at)
           VALUES ($1, 'main', NOW())
           ON CONFLICT (singleton_key)
           DO UPDATE SET store_open = EXCLUDED.store_open, updated_at = NOW()`,
          [val],
        );
        return res.json({ data: { key, value: val } });
      }
      if (key === "delivery_active" || key === "pickup_active") {
        const col = key === "delivery_active" ? "manual_active" : "pickup_active";
        await pool.query(
          `INSERT INTO "delivery_settings" ("${col}", singleton_key, updated_at)
           VALUES ($1, 'main', NOW())
           ON CONFLICT (singleton_key)
           DO UPDATE SET "${col}" = EXCLUDED."${col}", updated_at = NOW()`,
          [val],
        );
        return res.json({ data: { key, value: val } });
      }
      return res.status(400).json({ error: "Unknown key" });
    }

    if (action === "updateAllSettings") {
      const deliveryVal =
        value?.delivery_active === true || value?.delivery_active === "true";
      const pickupVal =
        value?.pickup_active === true || value?.pickup_active === "true";
      await pool.query(
        `INSERT INTO "delivery_settings" (manual_active, pickup_active, singleton_key, updated_at)
         VALUES ($1, $2, 'main', NOW())
         ON CONFLICT (singleton_key)
         DO UPDATE SET manual_active = EXCLUDED.manual_active,
                       pickup_active = EXCLUDED.pickup_active,
                       updated_at = NOW()`,
        [deliveryVal, pickupVal],
      );
      return res.json({
        data: { delivery_active: deliveryVal, pickup_active: pickupVal },
      });
    }

    // saveDeliverySettings / updateDeliverySettings are aliases
    if (
      action === "saveDeliverySettings" ||
      action === "updateDeliverySettings"
    ) {
      const settingsData = (data || value) as Record<string, any>;
      const entries = Object.entries(settingsData).filter(
        ([c, v]) =>
          v !== undefined &&
          c !== "id" &&
          c !== "singleton_key" &&
          c !== "created_at",
      );
      const cols = entries.map(([c]) => `"${sc(c)}"`).join(", ");
      const vals = entries.map(([, v]) => ser(v));
      const phs = vals.map((_, i) => `$${i + 1}`).join(", ");
      const updateSets = entries
        .map(([c]) => `"${sc(c)}" = EXCLUDED."${sc(c)}"`)
        .join(", ");
      const { rows } = await pool.query(
        `INSERT INTO "delivery_settings" (${cols}, singleton_key, updated_at)
         VALUES (${phs}, 'main', NOW())
         ON CONFLICT (singleton_key)
         DO UPDATE SET ${updateSets}, updated_at = NOW()
         RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    // ── Generic table CRUD (authenticated) ──────────────────────────────────
    if (!rawTable) {
      return res.status(400).json({ error: "Unknown action" });
    }
    const table = vt(rawTable);

    if (action === "insert") {
      const entries = Object.entries(
        (data ?? {}) as Record<string, any>,
      ).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const cols = entries.map(([c]) => `"${sc(c)}"`).join(", ");
      const vals = entries.map(([, v]) => ser(v));
      const phs = vals.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await pool.query(
        `INSERT INTO "${table}" (${cols}) VALUES (${phs}) RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "update") {
      const upd = (updates ?? data ?? {}) as Record<string, any>;
      const entries = Object.entries(upd).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const vals = entries.map(([, v]) => ser(v));
      const sets = entries
        .map(([c], i) => `"${sc(c)}" = $${i + 1}`)
        .join(", ");
      vals.push(id);
      const { rows } = await pool.query(
        `UPDATE "${table}" SET ${sets} WHERE "id" = $${vals.length} RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "upsert") {
      const entries = Object.entries(
        (data ?? {}) as Record<string, any>,
      ).filter(([, v]) => v !== undefined);
      if (!entries.length) return res.json({ data: {} });
      const cols = entries.map(([c]) => `"${sc(c)}"`).join(", ");
      const vals = entries.map(([, v]) => ser(v));
      const phs = vals.map((_, i) => `$${i + 1}`).join(", ");
      const conflictCol = upsert_column ? `"${sc(upsert_column)}"` : '"id"';
      const updateSets = entries
        .filter(([c]) => c !== (upsert_column || "id"))
        .map(([c]) => `"${sc(c)}" = EXCLUDED."${sc(c)}"`)
        .join(", ");
      const conflictClause = updateSets
        ? `ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSets}`
        : `ON CONFLICT (${conflictCol}) DO NOTHING`;
      const { rows } = await pool.query(
        `INSERT INTO "${table}" (${cols}) VALUES (${phs}) ${conflictClause} RETURNING *`,
        vals,
      );
      return res.json({ data: rows[0] });
    }

    if (action === "select") {
      const q = (query ?? {}) as Record<string, any>;
      const qEntries = Object.entries(q);
      const vals: any[] = [];
      const where = qEntries.length
        ? "WHERE " +
          qEntries
            .map(([c, v]) => {
              vals.push(v);
              return `"${sc(c)}" = $${vals.length}`;
            })
            .join(" AND ")
        : "";
      const { rows } = await pool.query(
        `SELECT * FROM "${table}" ${where} ORDER BY "created_at" DESC LIMIT 200`,
        vals,
      );
      return res.json({ data: rows });
    }

    if (action === "select_one") {
      const q = (query ?? {}) as Record<string, any>;
      const qEntries = Object.entries(q);
      const vals: any[] = [];
      const where = qEntries.length
        ? "WHERE " +
          qEntries
            .map(([c, v]) => {
              vals.push(v);
              return `"${sc(c)}" = $${vals.length}`;
            })
            .join(" AND ")
        : "";
      const { rows } = await pool.query(
        `SELECT * FROM "${table}" ${where} LIMIT 1`,
        vals,
      );
      return res.json({ data: rows[0] ?? null });
    }

    if (action === "delete_one") {
      await pool.query(`DELETE FROM "${table}" WHERE "id" = $1`, [id]);
      return res.json({ success: true });
    }

    if (action === "delete_many") {
      if (!ids?.length) return res.json({ success: true });
      await pool.query(
        `DELETE FROM "${table}" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
      return res.json({ success: true });
    }

    if (action === "delete_all") {
      await pool.query(`DELETE FROM "${table}"`);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    req.log.error({ err }, "adminSettings error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: Image Upload (presigned URL) ────────────────────────────────────
const objectStorageService = new ObjectStorageService();

router.post('/admin/uploadImage', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { name, contentType } = req.body;
    if (!name || !contentType) {
      return res.status(400).json({ error: 'name y contentType son requeridos' });
    }
    const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURLWithPath();
    // The serving URL clients store in menu_items.image_url
    const imageUrl = `/api/storage${objectPath}`;
    return res.json({ uploadURL, objectPath, imageUrl });
  } catch (err: any) {
    req.log.error({ err }, 'uploadImage error');
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: Publish uploaded image (set ACL to public) ─────────────────────
router.post('/admin/publishImage', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { objectPath } = req.body;
    if (!objectPath || !objectPath.startsWith('/objects/')) {
      return res.status(400).json({ error: 'objectPath inválido' });
    }
    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: 'admin',
      visibility: 'public',
    });
    return res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, 'publishImage error');
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: Menu Items CRUD ─────────────────────────────────────────────────
router.post('/admin/menuItems', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { name, description, price, price_23cm, category, image_url, available, sort_order } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ error: 'name, price y category son requeridos' });
    }
    const { rows } = await pool.query(
      `INSERT INTO "menu_items" (name, description, price, price_23cm, category, image_url, available, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        parseFloat(price),
        price_23cm != null ? parseFloat(price_23cm) : null,
        category,
        image_url || null,
        available !== false,
        sort_order ?? 0,
      ],
    );
    return res.json({ data: rows[0] });
  } catch (err: any) {
    req.log.error({ err }, 'admin/menuItems POST error');
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/admin/menuItems/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const allowed = ['name', 'description', 'price', 'price_23cm', 'category', 'image_url', 'available', 'sort_order'];
    const body = req.body as Record<string, any>;
    const entries = Object.entries(body).filter(([k]) => allowed.includes(k) && body[k] !== undefined);
    if (!entries.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const vals: any[] = entries.map(([, v]) => v);
    const sets = entries.map(([c], i) => `"${sc(c)}" = $${i + 1}`).join(', ');
    vals.push(req.params['id']);
    const { rows } = await pool.query(
      `UPDATE "menu_items" SET ${sets} WHERE "id" = $${vals.length} RETURNING *`,
      vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    req.log.error({ err }, 'admin/menuItems PATCH error');
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/menuItems/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { rowCount } = await pool.query(
      `DELETE FROM "menu_items" WHERE "id" = $1`,
      [req.params['id']],
    );
    if (!rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, 'admin/menuItems DELETE error');
    return res.status(500).json({ error: err.message });
  }
});

// ── ESC/POS byte generator (backend) ──────────────────────────────────────
const ESC_POS_INIT   = [0x1b, 0x40];
const ESC_CENTER     = [0x1b, 0x61, 0x01];
const ESC_LEFT       = [0x1b, 0x61, 0x00];
const ESC_BOLD_ON    = [0x1b, 0x45, 0x01];
const ESC_BOLD_OFF   = [0x1b, 0x45, 0x00];
const GS_DOUBLE      = [0x1d, 0x21, 0x11];
const GS_NORMAL      = [0x1d, 0x21, 0x00];
const GS_DHEIGHT     = [0x1d, 0x21, 0x10];
const GS_CUT         = [0x1d, 0x56, 0x00];

const PAYMENT_ES: Record<string, string> = {
  efectivo: 'EFECTIVO', tarjeta: 'TARJETA', bizum: 'BIZUM', datafono: 'DATAFONO',
};

function buildEscPosBuffer(order: any, widthMm = 80): Buffer {
  const W = widthMm === 58 ? 32 : 42;
  const bytes: number[] = [];

  const push  = (...vals: number[]) => bytes.push(...vals);
  const pushS = (s: string) => { for (const c of s) bytes.push(c.charCodeAt(0) & 0xff); };
  const pushL = (s = '') => { pushS(s); push(0x0a); };

  const orderId = ((order.id as string)?.slice(-6) || '??????').toUpperCase();
  const dateStr = new Date(order.created_at).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isDelivery = order.order_type !== 'pickup';

  push(...ESC_POS_INIT);
  push(...ESC_CENTER);
  push(...GS_DOUBLE);  pushL('MOZZARELLA Y FUEGO');
  push(...GS_NORMAL);  pushL('Pizzeria - Barcelona');
  push(...ESC_LEFT);   pushL('-'.repeat(W));

  push(...ESC_CENTER, ...ESC_BOLD_ON);
  pushL(`PEDIDO #${orderId}`);
  push(...ESC_BOLD_OFF);
  pushL(dateStr);
  pushL(isDelivery ? '** DOMICILIO **' : '** RECOGIDA LOCAL **');
  push(...ESC_LEFT);   pushL('-'.repeat(W));

  push(...ESC_BOLD_ON); pushL(order.customer_name || '-'); push(...ESC_BOLD_OFF);
  pushL(`Tel: ${order.customer_phone || '-'}`);
  if (isDelivery && order.customer_address) pushL(order.customer_address);
  if (!isDelivery && order.pickup_time)     pushL(`Recogida: ${order.pickup_time}`);
  if (order.customer_notes) { pushL('-'.repeat(W)); pushL(`Notas: ${order.customer_notes}`); }

  pushL('-'.repeat(W)); pushL('ARTICULOS'); pushL('-'.repeat(W));

  for (const item of (order.items || []) as any[]) {
    const name  = `${item.quantity}x ${item.name}`;
    const price = `${(item.price * item.quantity).toFixed(2)}E`;
    const gap   = W - name.length - price.length;
    gap > 0 ? pushL(name + ' '.repeat(gap) + price) : (pushL(name), pushL(' '.repeat(Math.max(0, W - price.length)) + price));
    for (const r of item.removed_ingredients || []) pushL(`  - SIN ${String(r).toUpperCase()}`);
    for (const e of item.extras || [])               pushL(`  + ${e}`);
  }

  pushL('='.repeat(W));
  if (order.delivery_fee > 0) { const v = `${order.delivery_fee.toFixed(2)} EUR`; pushL('Envio:' + ' '.repeat(Math.max(1, W - 6 - v.length)) + v); }
  if (order.tip > 0)          { const v = `+${order.tip.toFixed(2)} EUR`;          pushL('Propina:' + ' '.repeat(Math.max(1, W - 8 - v.length)) + v); }

  push(...ESC_BOLD_ON, ...GS_DHEIGHT);
  pushL(`TOTAL: ${(order.total || 0).toFixed(2)} EUR`);
  push(...GS_NORMAL, ...ESC_BOLD_OFF);

  pushL(`Pago: ${PAYMENT_ES[order.payment_method] || String(order.payment_method || '-').toUpperCase()}`);
  pushL('-'.repeat(W));
  push(...ESC_CENTER); pushL(''); pushL('Gracias por su pedido!'); pushL(''); pushL(''); pushL('');
  push(...GS_CUT);

  return Buffer.from(bytes);
}

// ── SSRF guard: only allow RFC-1918 LAN printer addresses ─────────────────
const ALLOWED_PRINTER_PORTS = new Set([9100, 515, 631, 9101, 9102]);

function validatePrinterTarget(ip: string, portRaw: string): { ok: true; port: number } | { ok: false; error: string } {
  // Must be a bare IPv4 literal — reject hostnames that could resolve to internal services
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return { ok: false, error: 'La IP de la impresora debe ser una dirección IPv4 (ej: 192.168.1.100)' };
  }
  const octets = ip.split('.').map(Number);
  if (octets.some(o => o < 0 || o > 255)) {
    return { ok: false, error: 'Dirección IPv4 no válida' };
  }
  const [a, b] = octets;
  // Reject loopback, link-local, and anything that isn't a private LAN range
  const isPrivate =
    (a === 10) ||                       // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168);            // 192.168.0.0/16
  if (!isPrivate) {
    return { ok: false, error: 'Solo se permiten impresoras en la red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)' };
  }
  const port = parseInt(portRaw, 10);
  if (!ALLOWED_PRINTER_PORTS.has(port)) {
    return {
      ok: false,
      error: `Puerto no permitido. Puertos válidos para impresoras térmicas: ${[...ALLOWED_PRINTER_PORTS].join(', ')}`,
    };
  }
  return { ok: true, port };
}

// ── Admin: Confirm order (status + optional print + optional WhatsApp) ─────
// Single authenticated server endpoint that atomically:
//  1. Sets status = 'confirmed'
//  2. Sends ESC/POS to network printer (if printer_config.mode === 'network')
//  3. Sends WhatsApp to assigned driver via green-api (if whatsapp === true)
// The status is always saved; print/WhatsApp failures are reported but don't
// roll back the status change.
router.post('/admin/orders/:id/confirm', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const orderId = req.params['id'];
    if (!UUID_RE.test(orderId)) {
      return res.status(400).json({ error: 'ID de pedido no válido' });
    }

    // 1. Update order status
    const { rows: orderRows } = await pool.query(
      `UPDATE "orders" SET status = 'confirmed' WHERE id = $1 RETURNING *`,
      [orderId],
    );
    if (!orderRows.length) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const order = orderRows[0];

    const result: Record<string, any> = { order };

    // 2. Network print (optional)
    const printerCfg = req.body.printer_config as any;
    if (printerCfg?.mode === 'network') {
      const ipRaw   = String(printerCfg.ip || '');
      const portRaw = String(printerCfg.port || '9100');
      const validation = validatePrinterTarget(ipRaw, portRaw);
      if (!validation.ok) {
        result.print = { ok: false, error: validation.error };
      } else {
        const widthMm = Number(printerCfg.widthMm) === 58 ? 58 : 80;
        const buf = buildEscPosBuffer(order, widthMm);
        try {
          await new Promise<void>((resolve, reject) => {
            const socket = net.createConnection({ host: ipRaw, port: validation.port }, () => {
              socket.write(buf, (err) => { if (err) { socket.destroy(); reject(err); return; } socket.end(); resolve(); });
            });
            socket.on('error', reject);
            socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('Timeout de conexión con la impresora')); });
          });
          result.print = { ok: true, bytes: buf.length };
        } catch (printErr: any) {
          result.print = { ok: false, error: printErr.message };
        }
      }
    }

    // 3. WhatsApp notification (optional)
    if (req.body.whatsapp === true && order.assigned_driver_id) {
      const instanceId = process.env['GREEN_API_INSTANCE_ID'];
      const token      = process.env['GREEN_API_TOKEN'];
      if (!instanceId || !token) {
        result.whatsapp = { ok: false, error: 'GREEN_API no configurado' };
      } else {
        try {
          const { rows: driverRows } = await pool.query(
            `SELECT * FROM "delivery_guys" WHERE id = $1`,
            [order.assigned_driver_id],
          );
          const driver = driverRows[0];
          if (!driver) {
            result.whatsapp = { ok: false, error: 'Repartidor no encontrado' };
          } else {
            let phone = String(driver.phone).replace(/\D/g, '');
            if (phone.startsWith('6') || phone.startsWith('7') || phone.startsWith('9')) phone = '34' + phone;
            const chatId = `${phone}@c.us`;
            const oId    = ((order.id as string)?.slice(-6) || '??????').toUpperCase();
            const isDelivery = order.order_type !== 'pickup';
            const itemsList  = ((order.items || []) as any[]).map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n');
            const lines = [
              `🍕 *Nuevo pedido #${oId}*`, '',
              `👤 *Cliente:* ${order.customer_name}`,
              `📞 ${order.customer_phone}`,
              isDelivery && order.customer_address ? `📍 ${order.customer_address}` : null,
              order.customer_notes ? `📝 ${order.customer_notes}` : null,
              '', '*Artículos:*', itemsList, '',
              `💶 *Total: ${(order.total || 0).toFixed(2)} €*`,
            ].filter((l): l is string => l !== null && l !== undefined);
            const message = lines.join('\n');
            const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
            // Bound to 8 s so a stalled Green API never hangs the confirm response
            const gRes  = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId, message }),
              signal: AbortSignal.timeout(8000),
            });
            const gData = (await gRes.json()) as any;
            result.whatsapp = gRes.ok && !gData.error
              ? { ok: true, idMessage: gData.idMessage }
              : { ok: false, error: gData.error || 'Error de green-api' };
          }
        } catch (waErr: any) {
          result.whatsapp = { ok: false, error: waErr.message };
        }
      }
    }

    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, 'admin/orders/confirm error');
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: Network print (TCP → ESC/POS) ──────────────────────────────────
router.post('/admin/print', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { order, ip, port: portRaw } = req.body;
    if (!order || !ip || !portRaw) {
      return res.status(400).json({ error: 'order, ip y port son requeridos' });
    }
    const validation = validatePrinterTarget(String(ip), String(portRaw));
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    const widthMm = Number(req.body.widthMm) === 58 ? 58 : 80;
    const buf = buildEscPosBuffer(order, widthMm);
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port: validation.port }, () => {
        socket.write(buf, (err) => {
          if (err) { socket.destroy(); reject(err); return; }
          socket.end();
          resolve();
        });
      });
      socket.on('error', reject);
      socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('Timeout de conexión con la impresora')); });
    });
    return res.json({ success: true, bytes: buf.length });
  } catch (err: any) {
    req.log.error({ err }, 'admin/print error');
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin: WhatsApp notify driver via green-api ────────────────────────────
router.post('/admin/notifyDriver', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { order, driver } = req.body;

    const instanceId = process.env['GREEN_API_INSTANCE_ID'];
    const token      = process.env['GREEN_API_TOKEN'];
    if (!instanceId || !token) {
      return res.status(503).json({
        error: 'GREEN_API no configurado. Añade GREEN_API_INSTANCE_ID y GREEN_API_TOKEN en los secrets del servidor.',
      });
    }
    if (!order || !driver?.phone) {
      return res.status(400).json({ error: 'order y driver.phone son requeridos' });
    }

    // Normalise Spanish phone → international format (chatId for green-api)
    let phone = String(driver.phone).replace(/\D/g, '');
    if (phone.startsWith('6') || phone.startsWith('7') || phone.startsWith('9')) phone = '34' + phone;
    const chatId = `${phone}@c.us`;

    const orderId  = ((order.id as string)?.slice(-6) || '??????').toUpperCase();
    const isDelivery = order.order_type !== 'pickup';
    const itemsList = ((order.items || []) as any[])
      .map((i: any) => `• ${i.quantity}x ${i.name}`)
      .join('\n');

    const lines = [
      `🍕 *Nuevo pedido #${orderId}*`,
      '',
      `👤 *Cliente:* ${order.customer_name}`,
      `📞 ${order.customer_phone}`,
      isDelivery && order.customer_address ? `📍 ${order.customer_address}` : null,
      order.customer_notes ? `📝 ${order.customer_notes}` : null,
      '',
      '*Artículos:*',
      itemsList,
      '',
      `💶 *Total: ${(order.total || 0).toFixed(2)} €*`,
    ].filter((l): l is string => l !== null && l !== undefined);

    const message = lines.join('\n');
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;

    const gRes  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId, message }),
    });
    const gData = (await gRes.json()) as any;
    if (!gRes.ok || gData.error) {
      return res.status(502).json({ error: gData.error || 'Error de green-api', detail: gData });
    }
    return res.json({ success: true, idMessage: gData.idMessage });
  } catch (err: any) {
    req.log.error({ err }, 'admin/notifyDriver error');
    return res.status(500).json({ error: err.message });
  }
});

export default router;
