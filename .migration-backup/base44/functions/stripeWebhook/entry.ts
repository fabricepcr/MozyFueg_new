import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event;
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};

      if (session.payment_status === 'paid') {
        const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
        const supabase = createClient(rawUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

        const orderId = meta.order_id;

        if (orderId) {
          // Actualizar pedido existente creado en createCheckoutSession
          const { error } = await supabase.from('orders').update({
            status: 'pending',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            total: session.amount_total / 100,
          }).eq('id', orderId);

          if (error) {
            console.error('Supabase update error:', error);
          } else {
            console.log('Order confirmed from webhook:', orderId);
          }
        } else {
          // Fallback: crear pedido desde metadatos legacy
          const items = meta.items_json ? JSON.parse(meta.items_json) : [];
          const { error } = await supabase.from('orders').insert({
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
          });
          if (error) console.error('Supabase insert error (legacy):', error);
          else console.log('Order created from webhook (legacy):', session.id);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});