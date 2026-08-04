/* eslint-env node */
/* global process */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const supabase = createClient(rawUrl, serviceKey);

    const { orderData } = req.body;

    console.log('[createOrderDirect] req.body keys:', req.body ? Object.keys(req.body) : 'null');
    console.log('[createOrderDirect] orderData:', JSON.stringify(orderData));
    console.log('[createOrderDirect] customer_name:', orderData?.customer_name, '| type:', typeof orderData?.customer_name);

    if (!orderData || !orderData.items || !orderData.total) {
      return res.status(400).json({ error: 'Missing order data' });
    }

    const { data: insertedOrder, error: insertError } = await supabase.from('orders').insert({
      customer_name: String(orderData.customer_name || 'Sin nombre').trim() || 'Sin nombre',
      customer_phone: String(orderData.customer_phone || 'Sin teléfono').trim() || 'Sin teléfono',
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
      return res.status(500).json({ error: insertError.message });
    }

    console.log('Order created directly:', insertedOrder.id);
    return res.json({ orderId: insertedOrder.id });
  } catch (error) {
    console.error('createOrderDirect error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}