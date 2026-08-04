import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = express();

app.use('/api/stripeWebhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors({ origin: '*' }));

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Configuración de reparto ───────────────────────────────────────────────
const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;

function calcDeliveryFee(km) {
  if (km <= 4) return 4;
  if (km <= 5) return 5;
  if (km <= 6) return 6;
  if (km <= 7) return 7;
  return 8;
}

app.post('/api/createCheckoutSession', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();
  try {
    const { orderData, successUrl, cancelUrl } = req.body;
    const {
      items, total, customer_name, customer_phone, customer_address,
      customer_notes, delivery_fee, tip, order_type, pickup_time, subtotal,
      delivery_distance_km,
    } = orderData;

    const { data: order, error: dbError } = await supabase
      .from('orders')
      .insert([{
        customer_name: String(customer_name || 'Sin nombre').trim(),
        customer_phone: String(customer_phone || 'Sin teléfono').trim(),
        customer_address: customer_address || '',
        customer_notes: customer_notes || '',
        items, total, delivery_fee, tip, order_type,
        pickup_time: pickup_time || '',
        delivery_distance_km: delivery_distance_km || null,
        status: 'payment_pending',
        subtotal,
        payment_method: 'tarjeta',
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    if (delivery_fee > 0) lineItems.push({
      price_data: { currency: 'eur', product_data: { name: 'Envío' }, unit_amount: Math.round(delivery_fee * 100) },
      quantity: 1,
    });

    if (tip > 0) lineItems.push({
      price_data: { currency: 'eur', product_data: { name: 'Propina' }, unit_amount: Math.round(tip * 100) },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `https://www.mozzarellayfuego.com/pedido-confirmado?stripe=1&session={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { order_id: order.id },
    });

    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);

    res.json({ sessionId: session.id, url: session.url, orderId: order.id });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/createOrderDirect', async (req, res) => {
  const supabase = getSupabase();
  try {
    const { items, total, customer_name, customer_phone, customer_address,
      delivery_fee, tip, order_type, pickup_time, payment_method } = req.body;
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name, customer_phone, customer_address, items, total,
        delivery_fee, tip, order_type, pickup_time, payment_method,
        status: 'pending', subtotal: total - delivery_fee - tip,
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, orderId: data.id });
  } catch (error) {
    console.error('createOrderDirect error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Cálculo de envío por carretera real (Google Distance Matrix) ───────────
// El cliente manda las coordenadas del destino; aquí preguntamos a Google la
// distancia REAL por calle (no en línea recta) y decidimos si entra en zona.
// La API key vive solo aquí (Railway), nunca en el navegador, y el cliente no
// puede falsear la distancia.
app.post('/api/calcularEnvio', async (req, res) => {
  try {
    const { destLat, destLng } = req.body;

    if (!isFinite(destLat) || !isFinite(destLng)) {
      return res.status(400).json({ error: 'Coordenadas de destino no válidas' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Falta GOOGLE_MAPS_API_KEY en las variables de entorno');
      return res.status(500).json({ error: 'Configuración de mapas no disponible' });
    }

    const origin = `${RESTAURANT_LAT},${RESTAURANT_LNG}`;
    const destination = `${destLat},${destLng}`;
    // mode=driving: ruta por calles reales (lo que sigue una moto en ciudad).
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${origin}`
      + `&destinations=${destination}`
      + `&mode=driving`
      + `&departure_time=now`   // usa tráfico actual para el tiempo estimado
      + `&language=es`
      + `&region=es`
      + `&key=${apiKey}`;

    const gRes = await fetch(url);
    const gData = await gRes.json();

    if (gData.status !== 'OK') {
      console.error('Google Distance Matrix status:', gData.status, gData.error_message || '');
      return res.status(502).json({ error: 'No se pudo calcular la distancia' });
    }

    const element = gData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      // ZERO_RESULTS = no hay ruta por carretera hasta ahí
      return res.json({ ok: false, reason: 'no_route' });
    }

    // Google devuelve metros y segundos
    const km = parseFloat((element.distance.value / 1000).toFixed(2));
    const durationSec = (element.duration_in_traffic || element.duration).value;
    const estimatedMin = Math.round(durationSec / 60) + 15; // +15 min de preparación

    if (km > MAX_DELIVERY_KM) {
      return res.json({ ok: false, reason: 'too_far', km });
    }

    const fee = calcDeliveryFee(km);
    return res.json({ ok: true, km, fee, estimatedMin });
  } catch (error) {
    console.error('calcularEnvio error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/menuItems', async (req, res) => {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('menu_items').select('*').eq('available', true)
      .order('sort_order', { ascending: true }).limit(200);
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('menuItems error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refundOrder', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();
  const { orderId, adminPassword } = req.body;
  if (adminPassword !== 'mozzarellayfuego123') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const { data: order, error: fetchError } = await supabase
      .from('orders').select('*').eq('id', orderId).single();
    if (fetchError) throw fetchError;
    if (order.stripe_payment_intent_id) {
      await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
    }
    const { error: updateError } = await supabase.from('orders')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (error) {
    console.error('refundOrder error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripeWebhook', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await supabase.from('orders').update({
          status: 'confirmed',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
        }).eq('id', orderId);
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/supabaseProxy', async (req, res) => {
  const supabase = getSupabase();
  try {
    const { action, table, data, query, id, updates } = req.body;
    if (action === 'insert') {
      const { data: result, error } = await supabase.from(table).insert(data).select().single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === 'update') {
      const { data: result, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === 'select') {
      let q = supabase.from(table).select('*');
      if (query) for (const [col, val] of Object.entries(query)) q = q.eq(col, val);
      const { data: result, error } = await q.order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return res.json({ data: result });
    }
    if (action === 'select_one') {
      let q = supabase.from(table).select('*');
      if (query) for (const [col, val] of Object.entries(query)) q = q.eq(col, val);
      const { data: result, error } = await q.limit(1).single();
      if (error?.code !== 'PGRST116' && error) throw error;
      return res.json({ data: result || null });
    }
    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('supabaseProxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
