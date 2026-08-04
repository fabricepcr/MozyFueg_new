import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { orderData, successUrl, cancelUrl } = req.body;
    const {
      items,
      total,
      customer_name,
      customer_phone,
      customer_address,
      customer_notes,
      delivery_fee,
      tip,
      order_type,
      pickup_time,
      subtotal,
    } = orderData;

    // Crear orden en Supabase
    const { data: order, error: dbError } = await supabase
      .from('orders')
      .insert([{
        customer_name,
        customer_phone,
        customer_address,
        customer_notes,
        items,
        total,
        delivery_fee,
        tip,
        order_type,
        pickup_time,
        status: 'payment_pending',
        subtotal,
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })).concat([
        delivery_fee > 0 && {
          price_data: { currency: 'eur', product_data: { name: 'Envío' }, unit_amount: Math.round(delivery_fee * 100) },
          quantity: 1,
        },
        tip > 0 && {
          price_data: { currency: 'eur', product_data: { name: 'Propina' }, unit_amount: Math.round(tip * 100) },
          quantity: 1,
        },
      ]).filter(Boolean),
      mode: 'payment',
      success_url: successUrl.replace('{orderId}', '{CHECKOUT_SESSION_ID}'),
      cancel_url: cancelUrl,
      metadata: { order_id: order.id },
    });

    res.json({ sessionId: session.id, url: session.url, orderId: order.id });

  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
