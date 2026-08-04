import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_PASSWORD = "mozzarellayfuego123";
const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;
const ALLOWED_TABLES = new Set([
  "orders",
  "menu_items",
  "store_settings",
  "delivery_settings",
  "reservations",
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

// ── Stripe: create checkout session ────────────────────────────────────────
router.post("/createCheckoutSession", async (req, res) => {
  try {
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "");
    const { orderData, successUrl, cancelUrl } = req.body;

    if (!orderData?.items?.length) {
      return res.status(400).json({ error: "Missing or empty order items" });
    }

    const subtotal =
      parseFloat(orderData.subtotal) ||
      orderData.items.reduce(
        (s: number, i: any) => s + i.price * i.quantity,
        0,
      );
    const delivery_fee = parseFloat(orderData.delivery_fee) || 0;
    const tip = parseFloat(orderData.tip) || 0;
    const total =
      parseFloat(orderData.total) > 0
        ? parseFloat(orderData.total)
        : parseFloat((subtotal + delivery_fee + tip).toFixed(2));

    const { rows } = await pool.query(
      `INSERT INTO "orders"
         (customer_name, customer_phone, customer_address, customer_notes,
          pickup_time, order_type, payment_method, status, items,
          subtotal, delivery_fee, delivery_distance_km, tip, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        String(orderData.customer_name || "Sin nombre").trim(),
        String(orderData.customer_phone || "Sin teléfono").trim(),
        orderData.customer_address || "",
        orderData.customer_notes || "",
        orderData.pickup_time || "",
        orderData.order_type || "delivery",
        "tarjeta",
        "payment_pending",
        JSON.stringify(orderData.items),
        subtotal,
        delivery_fee,
        parseFloat(orderData.delivery_distance_km) || null,
        tip,
        total,
      ],
    );
    const order = rows[0];

    const lineItems = orderData.items.map((item: any) => ({
      price_data: {
        currency: "eur",
        product_data: { name: String(item.name || "Producto") },
        unit_amount: Math.max(1, Math.round((item.price || 0) * 100)),
      },
      quantity: Math.max(1, parseInt(item.quantity) || 1),
    }));
    if (delivery_fee > 0)
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Gastos de envío" },
          unit_amount: Math.round(delivery_fee * 100),
        },
        quantity: 1,
      });
    if (tip > 0)
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Propina para el repartidor" },
          unit_amount: Math.round(tip * 100),
        },
        quantity: 1,
      });

    const origin =
      (req.headers["origin"] as string) || "https://mozzarellayfuego.com";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url:
        successUrl ||
        `${origin}/pedido-confirmado?orderId={CHECKOUT_SESSION_ID}&stripe=1`,
      cancel_url: cancelUrl || `${origin}/checkout`,
      payment_intent_data: {
        description: `Pedido Mozzarella y Fuego - ${order.customer_name}`,
      },
      metadata: {
        order_id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        order_type: order.order_type,
      },
    });

    await pool.query(
      `UPDATE "orders" SET stripe_session_id = $1 WHERE id = $2`,
      [session.id, order.id],
    );

    return res.json({
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    });
  } catch (err: any) {
    req.log.error({ err }, "createCheckoutSession error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Create order (cash / on-pickup) ────────────────────────────────────────
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

// ── Refund order ────────────────────────────────────────────────────────────
router.post("/refundOrder", async (req, res) => {
  try {
    const { orderId, adminPassword } = req.body;
    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (!orderId) return res.status(400).json({ error: "orderId requerido" });

    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "");

    const { rows } = await pool.query(
      `SELECT * FROM "orders" WHERE id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    let refundId: string | null = null;
    if (order.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_session_id,
        );
        if (session.payment_intent) {
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: "requested_by_customer",
          });
          refundId = refund.id;
        }
      } catch (stripeErr: any) {
        req.log.warn({ err: stripeErr }, "Stripe refund error");
      }
    }

    await pool.query(
      `UPDATE "orders" SET status = 'cancelled', refunded_at = NOW() WHERE id = $1`,
      [orderId],
    );

    return res.json({
      success: true,
      refundId,
      message: "Pedido cancelado correctamente",
    });
  } catch (err: any) {
    req.log.error({ err }, "refundOrder error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Stripe webhook ─────────────────────────────────────────────────────────
router.post("/stripeWebhook", async (req, res) => {
  const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "");
  const sig = req.headers["stripe-signature"] as string;
  try {
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
    );
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await pool.query(
          `UPDATE "orders"
           SET status = 'confirmed',
               stripe_session_id = $1,
               stripe_payment_intent_id = $2
           WHERE id = $3`,
          [session.id, session.payment_intent, orderId],
        );
      }
    }
    return res.json({ received: true });
  } catch (err: any) {
    req.log.error({ err }, "Stripe webhook error");
    return res.status(400).json({ error: err.message });
  }
});

// ── Generic CRUD proxy (replaces Supabase proxy) ───────────────────────────
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
    if (password !== ADMIN_PASSWORD) {
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

export default router;
