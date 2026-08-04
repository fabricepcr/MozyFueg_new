import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { orderId, password } = req.body;

  // Verificar contraseña admin
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Obtener orden
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    // Reembolsar en Stripe
    if (order.stripe_payment_intent_id) {
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id
      });
    }

    // Actualizar estado en Supabase
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error) {
    console.error('refundOrder error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
