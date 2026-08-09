import { Router, type IRouter } from "express";
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

export default router;
