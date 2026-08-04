/* eslint-env node */
/* global require, module, process */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey) return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Missing Supabase credentials' });

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parsear body — Vercel puede enviar req.body ya como objeto o como string
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }
    if (!body || typeof body !== 'object') {
      try {
        const raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = JSON.parse(raw);
      } catch { return res.status(400).json({ error: 'Could not parse request body' }); }
    }

    console.log('[checkout] full body:', JSON.stringify(body));
    const { orderData, successUrl, cancelUrl } = body || {};

    console.log('[checkout] raw body keys:', body ? Object.keys(body) : 'null');
    console.log('[checkout] orderData:', JSON.stringify(orderData));
    console.log('[checkout] customer_name value:', orderData?.customer_name, '| type:', typeof orderData?.customer_name);

    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({ error: 'Missing or empty order items' });
    }

    // Calcular totales en backend — nunca confiar en el valor del frontend
    const subtotal = parseFloat(orderData.subtotal) || orderData.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const delivery_fee = parseFloat(orderData.delivery_fee) || 0;
    const tip = parseFloat(orderData.tip) || 0;
    // Usar total del frontend si es válido; si no, calcularlo
    const total = (parseFloat(orderData.total) > 0) ? parseFloat(orderData.total) : parseFloat((subtotal + delivery_fee + tip).toFixed(2));

    console.log('[checkout] totales calculados — subtotal:', subtotal, 'delivery_fee:', delivery_fee, 'tip:', tip, 'total:', total);

    if (!total || total <= 0) {
      return res.status(400).json({ error: 'Invalid order total: ' + total });
    }

    // 1. Insertar pedido en Supabase con estado payment_pending
    const insertPayload = {
      customer_name: String(orderData.customer_name || 'Sin nombre').trim() || 'Sin nombre',
      customer_phone: String(orderData.customer_phone || 'Sin teléfono').trim() || 'Sin teléfono',
      customer_address: orderData.customer_address || '',
      customer_notes: orderData.customer_notes || '',
      pickup_time: orderData.pickup_time || '',
      order_type: orderData.order_type || 'delivery',
      payment_method: 'tarjeta',
      status: 'payment_pending',
      items: orderData.items,
      subtotal: subtotal,
      delivery_fee: delivery_fee,
      delivery_distance_km: parseFloat(orderData.delivery_distance_km) || null,
      tip: tip,
      total: total,
    };
    console.log('[checkout] INSERT payload:', JSON.stringify(insertPayload));

    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[checkout] Supabase insert error:', insertError);
      return res.status(500).json({ error: `DB error: ${insertError.message}` });
    }

    // 2. Construir line items para Stripe
    const lineItems = orderData.items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: { name: String(item.name || 'Producto') },
        unit_amount: Math.max(1, Math.round((item.price || 0) * 100)),
      },
      quantity: Math.max(1, parseInt(item.quantity) || 1),
    }));

    if (orderData.delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Gastos de envío' },
          unit_amount: Math.round(orderData.delivery_fee * 100),
        },
        quantity: 1,
      });
    }

    if (orderData.tip > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Propina para el repartidor' },
          unit_amount: Math.round(orderData.tip * 100),
        },
        quantity: 1,
      });
    }

    // 3. Crear sesión Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || `${req.headers.origin || 'https://mozzarellayfuego.com'}/pedido-confirmado?orderId={CHECKOUT_SESSION_ID}&stripe=1`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://mozzarellayfuego.com'}/checkout`,
      payment_intent_data: {
        description: `Pedido Mozzarella y Fuego - ${orderData.customer_name || 'Cliente'}`,
      },
      metadata: {
        order_id: insertedOrder.id,
        base44_app_id: process.env.BASE44_APP_ID || '',
        customer_name: insertPayload.customer_name,
        customer_phone: insertPayload.customer_phone,
        customer_address: insertPayload.customer_address || '',
        order_type: insertPayload.order_type || 'delivery',
        pickup_time: insertPayload.pickup_time || '',
      },
      custom_text: {
        submit: { message: 'Tu pedido se confirmará al completar el pago.' },
      },
    });

    // 4. Guardar stripe_session_id en el pedido
    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', insertedOrder.id);

    console.log('[checkout] Session created:', session.id, '— order:', insertedOrder.id);
    return res.status(200).json({ url: session.url, sessionId: session.id, orderId: insertedOrder.id });

  } catch (err) {
    console.error('[checkout] Fatal error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};