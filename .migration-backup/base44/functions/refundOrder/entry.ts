import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acceso restringido' }, { status: 403 });
    }

    const { orderId } = await req.json();
    if (!orderId) return Response.json({ error: 'orderId requerido' }, { status: 400 });

    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const supabase = createClient(rawUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });

    let refundResult = null;

    if (order.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        if (session.payment_intent) {
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            reason: 'requested_by_customer',
          });
          refundResult = refund;
          console.log('Stripe refund created:', refund.id);
        }
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError.message);
      }
    }

    await supabase.from('orders').update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    }).eq('id', orderId);

    return Response.json({
      success: true,
      refundId: refundResult?.id || null,
      message: 'Pedido cancelado y reembolsado correctamente',
    });
  } catch (error) {
    console.error('refundOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});