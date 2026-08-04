/* eslint-env node */
/* global require, module, process */
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { orderId, adminPassword } = req.body;
    if (adminPassword !== 'mozzarellayfuego123') return res.status(403).json({ error: 'No autorizado' });
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });

    const rawUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const supabase = createClient(rawUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: fetchError } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (fetchError || !order) return res.status(404).json({ error: 'Pedido no encontrado' });

    let refundId = null;
    if (order.stripe_session_id) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (session.payment_intent) {
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            reason: 'requested_by_customer',
          });
          refundId = refund.id;
        }
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError.message);
      }
    }

    await supabase.from('orders').update({
      status: 'cancelled',
      refunded_at: new Date().toISOString(),
    }).eq('id', orderId);

    return res.json({ success: true, refundId, message: 'Pedido cancelado correctamente' });
  } catch (error) {
    console.error('refundOrder error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};