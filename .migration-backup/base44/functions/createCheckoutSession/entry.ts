import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const supabase = createClient(rawUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const body = await req.json();
    const { orderData, successUrl, cancelUrl } = body || {};

    console.log('[deno-checkout] orderData recibido:', JSON.stringify(orderData));

    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return Response.json({ error: 'Missing or empty order items' }, { status: 400 });
    }

    // Calcular totales en backend — no confiar ciegamente en el frontend
    const subtotal = parseFloat(orderData.subtotal) > 0
      ? parseFloat(orderData.subtotal)
      : orderData.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
    const delivery_fee = parseFloat(orderData.delivery_fee) || 0;
    const tip = parseFloat(orderData.tip) || 0;
    const total = parseFloat(orderData.total) > 0
      ? parseFloat(orderData.total)
      : parseFloat((subtotal + delivery_fee + tip).toFixed(2));

    console.log('[deno-checkout] totales — subtotal:', subtotal, 'delivery_fee:', delivery_fee, 'tip:', tip, 'total:', total);

    if (!total || total <= 0) {
      return Response.json({ error: 'Invalid order total: ' + total }, { status: 400 });
    }

    const customerName = String(orderData.customer_name || '').trim() || 'Sin nombre';
    const customerPhone = String(orderData.customer_phone || '').trim() || 'Sin teléfono';

    // 1. Insertar pedido en Supabase con estado payment_pending
    const insertPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
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

    console.log('[deno-checkout] INSERT payload:', JSON.stringify(insertPayload));

    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[deno-checkout] Supabase insert error:', insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    console.log('[deno-checkout] Order pre-created:', insertedOrder.id);

    // 2. Construir line items para Stripe
    const lineItems = orderData.items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: { name: String(item.name || 'Producto') },
        unit_amount: Math.max(1, Math.round((item.price || 0) * 100)),
      },
      quantity: Math.max(1, parseInt(item.quantity) || 1),
    }));

    if (delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Gastos de envío' },
          unit_amount: Math.round(delivery_fee * 100),
        },
        quantity: 1,
      });
    }

    if (tip > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Propina para el repartidor' },
          unit_amount: Math.round(tip * 100),
        },
        quantity: 1,
      });
    }

    // 3. Crear sesión Stripe con el orderId en metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        description: `Pedido Mozzarella y Fuego - ${customerName}`,
      },
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        order_id: insertedOrder.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: orderData.customer_address || '',
        order_type: orderData.order_type || 'delivery',
        pickup_time: orderData.pickup_time || '',
      },
      custom_text: {
        submit: { message: 'Tu pedido se confirmará al completar el pago.' },
      },
    });

    // 4. Guardar stripe_session_id en el pedido
    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', insertedOrder.id);

    console.log('[deno-checkout] Session created:', session.id, '— order:', insertedOrder.id);
    return Response.json({ url: session.url, sessionId: session.id, orderId: insertedOrder.id });

  } catch (error) {
    console.error('[deno-checkout] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});