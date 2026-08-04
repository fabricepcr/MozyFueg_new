import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const router: IRouter = Router();

const ADMIN_PASSWORD = "mozzarellayfuego123";
const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;

function getSupabase() {
  const url =
    (process.env["SUPABASE_URL"] ?? "")
      .trim()
      .replace(/\/$/, "")
      .replace(/\/rest\/v1$/, "");
  const key = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("available", true)
      .order("sort_order", { ascending: true })
      .limit(200);
    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    req.log.error({ err }, "menuItems error");
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe: create checkout session ────────────────────────────────────────
router.post("/createCheckoutSession", async (req, res) => {
  try {
    const supabase = getSupabase();
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

    const insertPayload = {
      customer_name: String(orderData.customer_name || "Sin nombre").trim(),
      customer_phone: String(
        orderData.customer_phone || "Sin teléfono",
      ).trim(),
      customer_address: orderData.customer_address || "",
      customer_notes: orderData.customer_notes || "",
      pickup_time: orderData.pickup_time || "",
      order_type: orderData.order_type || "delivery",
      payment_method: "tarjeta",
      status: "payment_pending",
      items: orderData.items,
      subtotal,
      delivery_fee,
      delivery_distance_km: parseFloat(orderData.delivery_distance_km) || null,
      tip,
      total,
    };

    const { data: order, error: dbError } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select()
      .single();
    if (dbError) throw dbError;

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
        description: `Pedido Mozzarella y Fuego - ${insertPayload.customer_name}`,
      },
      metadata: {
        order_id: order.id,
        customer_name: insertPayload.customer_name,
        customer_phone: insertPayload.customer_phone,
        order_type: insertPayload.order_type,
      },
    });

    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return res.json({ url: session.url, sessionId: session.id, orderId: order.id });
  } catch (err: any) {
    req.log.error({ err }, "createCheckoutSession error");
    return res.status(500).json({ error: err.message });
  }
});

// ── Create order (cash / on-pickup) ────────────────────────────────────────
router.post("/createOrderDirect", async (req, res) => {
  try {
    const supabase = getSupabase();
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
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          customer_name,
          customer_phone,
          customer_address,
          items,
          total,
          delivery_fee,
          tip,
          order_type,
          pickup_time,
          payment_method,
          status: "pending",
          subtotal: total - delivery_fee - tip,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return res.json({ success: true, orderId: data.id });
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

    const supabase = getSupabase();
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "");

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (fetchError || !order)
      return res.status(404).json({ error: "Pedido no encontrado" });

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

    await supabase
      .from("orders")
      .update({ status: "cancelled", refunded_at: new Date().toISOString() })
      .eq("id", orderId);

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
// NOTE: raw body is configured in app.ts before express.json()
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
        const supabase = getSupabase();
        await supabase
          .from("orders")
          .update({
            status: "confirmed",
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
          })
          .eq("id", orderId);
      }
    }
    return res.json({ received: true });
  } catch (err: any) {
    req.log.error({ err }, "Stripe webhook error");
    return res.status(400).json({ error: err.message });
  }
});

// ── Supabase proxy (general CRUD for frontend db.js) ──────────────────────
router.post("/supabaseProxy", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { action, table, data, query, id, updates, ids, upsert_column } =
      req.body;

    if (action === "insert") {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "update") {
      const { data: result, error } = await supabase
        .from(table)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "upsert") {
      const upsertOpts = upsert_column
        ? { onConflict: upsert_column }
        : undefined;
      const { data: result, error } = await supabase
        .from(table)
        .upsert(data, upsertOpts)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "select") {
      let q = supabase.from(table).select("*");
      if (query)
        for (const [col, val] of Object.entries(query))
          q = (q as any).eq(col, val);
      const { data: result, error } = await (q as any)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "select_one") {
      let q = supabase.from(table).select("*");
      if (query)
        for (const [col, val] of Object.entries(query))
          q = (q as any).eq(col, val);
      const { data: result, error } = await (q as any).limit(1).maybeSingle();
      if (error?.code !== "PGRST116" && error) throw error;
      return res.json({ data: result || null });
    }
    if (action === "delete" || action === "delete_one") {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === "delete_many") {
      if (!ids?.length) return res.json({ success: true });
      const { error } = await supabase.from(table).delete().in("id", ids);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === "delete_all") {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
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
    const supabase = getSupabase();
    const { action, password, key, value, table, data, query, id, updates, ids, upsert_column } = req.body;

    // ── Public read (no auth needed) ──────────────────────────────────────
    if (action === "getPublicSettings") {
      const [{ data: storeArr }, { data: deliveryArr }] = await Promise.all([
        supabase.from("store_settings").select("store_open").limit(1),
        supabase
          .from("delivery_settings")
          .select("manual_active, pickup_active")
          .limit(1),
      ]);
      const storeOpen = storeArr?.[0]?.store_open !== false;
      const deliveryActive = deliveryArr?.[0]?.manual_active !== false;
      const pickupActive = deliveryArr?.[0]?.pickup_active !== false;
      return res.json({ data: { storeOpen, deliveryActive, pickupActive } });
    }

    if (action === "getDeliverySettings") {
      // Read current delivery settings row (no auth needed for read)
      const { data: row } = await supabase
        .from("delivery_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return res.json({ data: row || null });
    }

    // ── Auth required for mutations ──────────────────────────────────────
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (action === "updateSetting") {
      const val = value === true || value === "true";
      if (key === "store_open") {
        const { data: existing } = await supabase
          .from("store_settings")
          .select("id")
          .limit(1);
        const existingId = existing?.[0]?.id;
        if (existingId) {
          await supabase
            .from("store_settings")
            .update({ store_open: val })
            .eq("id", existingId);
        } else {
          await supabase
            .from("store_settings")
            .insert({ store_open: val, singleton_key: "main" });
        }
        return res.json({ data: { key, value: val } });
      }
      if (key === "delivery_active" || key === "pickup_active") {
        const { data: existing } = await supabase
          .from("delivery_settings")
          .select("id, manual_active, pickup_active")
          .limit(1);
        const row = existing?.[0];
        const updatesMap: any = {};
        if (key === "delivery_active") updatesMap.manual_active = val;
        if (key === "pickup_active") updatesMap.pickup_active = val;
        if (row?.id) {
          await supabase
            .from("delivery_settings")
            .update(updatesMap)
            .eq("id", row.id);
        } else {
          await supabase.from("delivery_settings").insert({
            mode: "manual",
            manual_active: key === "delivery_active" ? val : true,
            pickup_active: key === "pickup_active" ? val : true,
            singleton_key: "main",
          });
        }
        return res.json({ data: { key, value: val } });
      }
      return res.status(400).json({ error: "Unknown key" });
    }

    if (action === "updateAllSettings") {
      const deliveryVal =
        value?.delivery_active === true || value?.delivery_active === "true";
      const pickupVal =
        value?.pickup_active === true || value?.pickup_active === "true";
      const { data: existing } = await supabase
        .from("delivery_settings")
        .select("id")
        .limit(1);
      const row = existing?.[0];
      if (row?.id) {
        const { error: e1 } = await supabase
          .from("delivery_settings")
          .update({ manual_active: deliveryVal, pickup_active: pickupVal })
          .eq("id", row.id);
        if (e1) {
          await supabase
            .from("delivery_settings")
            .update({ manual_active: deliveryVal })
            .eq("id", row.id);
        }
      } else {
        await supabase.from("delivery_settings").insert({
          mode: "manual",
          singleton_key: "main",
          manual_active: deliveryVal,
          pickup_active: pickupVal,
        });
      }
      return res.json({
        data: { delivery_active: deliveryVal, pickup_active: pickupVal },
      });
    }

    if (action === "saveDeliverySettings") {
      const { data: existing } = await supabase
        .from("delivery_settings")
        .select("id")
        .limit(1);
      const row = existing?.[0];
      const settingsData = data || value;
      if (row?.id) {
        const { data: result, error } = await supabase
          .from("delivery_settings")
          .update(settingsData)
          .eq("id", row.id)
          .select()
          .single();
        if (error) throw error;
        return res.json({ data: result });
      } else {
        const { data: result, error } = await supabase
          .from("delivery_settings")
          .insert({ ...settingsData, singleton_key: "main" })
          .select()
          .single();
        if (error) throw error;
        return res.json({ data: result });
      }
    }

    // ── Generic table CRUD ────────────────────────────────────────────────
    if (!table) {
      return res.status(400).json({ error: "Unknown action" });
    }

    if (action === "insert") {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "update") {
      const { data: result, error } = await supabase
        .from(table)
        .update(updates ?? data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "upsert") {
      const upsertOpts = upsert_column ? { onConflict: upsert_column } : undefined;
      const { data: result, error } = await supabase
        .from(table)
        .upsert(data, upsertOpts)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "select") {
      let q = supabase.from(table).select("*");
      if (query)
        for (const [col, val] of Object.entries(query))
          q = (q as any).eq(col, val);
      const { data: result, error } = await (q as any)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === "select_one") {
      let q = supabase.from(table).select("*");
      if (query)
        for (const [col, val] of Object.entries(query))
          q = (q as any).eq(col, val);
      const { data: result, error } = await (q as any).limit(1).maybeSingle();
      if (error?.code !== "PGRST116" && error) throw error;
      return res.json({ data: result || null });
    }
    if (action === "delete_one") {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === "delete_many") {
      if (!ids?.length) return res.json({ success: true });
      const { error } = await supabase.from(table).delete().in("id", ids);
      if (error) throw error;
      return res.json({ success: true });
    }
    if (action === "delete_all") {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    req.log.error({ err }, "adminSettings error");
    return res.status(500).json({ error: err.message });
  }
});

export default router;
