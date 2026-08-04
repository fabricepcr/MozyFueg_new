import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { items, total, customer_name, customer_phone, customer_address, delivery_fee, tip, order_type, pickup_time, payment_method } = req.body;

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name,
        customer_phone,
        customer_address,
        items,
        total,
        delivery_fee,
        tip,
        order_type,
        pickup_time,
        payment_method,
        status: 'pending',
        subtotal: total - delivery_fee - tip
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, orderId: data.id });
  } catch (error) {
    console.error('createOrderDirect error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
