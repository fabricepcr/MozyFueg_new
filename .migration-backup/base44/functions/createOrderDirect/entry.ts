import { createClient } from 'npm:@supabase/supabase-js@2';

// Crea pedido directamente como "pending" sin pasar por Stripe (modo pruebas / efectivo)
Deno.serve(async (req) => {
  try {
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const supabase = createClient(rawUrl, serviceKey);

    const { orderData } = await req.json();

    if (!orderData || !orderData.items || !orderData.total) {
      return Response.json({ error: 'Missing order data' }, { status: 400 });
    }

    const { data: insertedOrder, error: insertError } = await supabase.from('orders').insert({
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_address: orderData.customer_address || '',
      customer_notes: orderData.customer_notes || '',
      pickup_time: orderData.pickup_time || '',
      order_type: orderData.order_type || 'delivery',
      payment_method: orderData.payment_method || 'efectivo',
      status: 'pending',
      items: orderData.items,
      subtotal: orderData.subtotal ?? null,
      delivery_fee: orderData.delivery_fee ?? 0,
      delivery_distance_km: orderData.delivery_distance_km ?? null,
      tip: orderData.tip ?? 0,
      total: orderData.total,
    }).select().single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    console.log('Order created directly:', insertedOrder.id);
    return Response.json({ orderId: insertedOrder.id });
  } catch (error) {
    console.error('createOrderDirect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});