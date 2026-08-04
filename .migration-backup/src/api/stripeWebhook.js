/* eslint-env node */
/* global require, module, process, Buffer */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Vercel: disable body parsing for raw access (needed for Stripe signature)
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = JSON.parse(rawBody.toString());
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};

      if (session.payment_status === 'paid') {
        const rawUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '');
        const supabase = createClient(rawUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const orderId = meta.order_id;

        if (orderId) {
          // Camino normal: el pedido ya existe, solo actualizamos estado
          const { error } = await supabase.from('orders').update({
            status: 'pending',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            total: session.amount_total / 100,
          }).eq('id', orderId);

          if (error) console.error('[webhook] Supabase update error:', error);
          else console.log('[webhook] Order confirmed:', orderId);
        } else {
          // Camino de respaldo: crear el pedido desde los metadatos
          const items = meta.items_json ? JSON.parse(meta.items_json) : [];
          const insertPayload = {
            customer_name: String(meta.customer_name || 'Cliente').trim() || 'Cliente',
            customer_phone: String(meta.customer_phone || 'Sin teléfono').trim() || 'Sin teléfono',
            customer_address: meta.customer_address || '',
            customer_notes: meta.customer_notes || '',
            pickup_time: meta.pickup_time || '',
            order_type: meta.order_type || 'delivery',
            payment_method: 'tarjeta',
            status: 'pending',
            items,
            subtotal: meta.subtotal ? parseFloat(meta.subtotal) : null,
            delivery_fee: meta.delivery_fee ? parseFloat(meta.delivery_fee) : 0,
            delivery_distance_km: meta.delivery_distance_km ? parseFloat(meta.delivery_distance_km) : null,
            tip: meta.tip ? parseFloat(meta.tip) : 0,
            total: session.amount_total ? parseFloat((session.amount_total / 100).toFixed(2)) : 0.01,
            stripe_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          };
          console.log('[webhook] INSERT payload (legacy):', JSON.stringify(insertPayload));
          const { error } = await supabase.from('orders').insert(insertPayload);
          if (error) console.error('[webhook] Supabase insert error (legacy):', error);
          else console.log('[webhook] Order created from webhook (legacy):', session.id);
        }
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[webhook] Error:', error);
    return res.status(400).json({ error: error.message });
  }
};