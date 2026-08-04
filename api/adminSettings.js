import { createClient } from '@supabase/supabase-js';

const ADMIN_PASSWORD = 'mozzarellayfuego123';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getRow(supabase, table) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabase = getSupabase();

  try {
    const { action, password, settings } = req.body || {};

    // ── Public read ─────────────────────────────────────────────────────────
    if (action === 'get') {
      const [storeRow, deliveryRow] = await Promise.all([
        getRow(supabase, 'store_settings'),
        getRow(supabase, 'delivery_settings'),
      ]);

      const pickupEnabled = deliveryRow?.schedule?._pickup !== false;

      return res.json({
        store_open: storeRow?.store_open !== false,
        delivery_enabled: deliveryRow?.manual_active !== false,
        pickup_enabled: pickupEnabled,
      });
    }

    // ── Admin write ─────────────────────────────────────────────────────────
    if (action === 'update') {
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Missing settings object' });
      }

      // 1. store_settings.store_open
      if (typeof settings.store_open === 'boolean') {
        const storeRow = await getRow(supabase, 'store_settings');
        if (storeRow) {
          const { error } = await supabase
            .from('store_settings')
            .update({ store_open: settings.store_open, updated_at: new Date().toISOString() })
            .eq('id', storeRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('store_settings')
            .insert({ store_open: settings.store_open, updated_at: new Date().toISOString() });
          if (error) throw error;
        }
      }

      // 2. delivery_settings.manual_active + schedule._pickup
      const deliveryRow = await getRow(supabase, 'delivery_settings');
      const deliveryUpdates = {};

      if (typeof settings.delivery_enabled === 'boolean') {
        deliveryUpdates.manual_active = settings.delivery_enabled;
      }
      if (typeof settings.pickup_enabled === 'boolean') {
        const existingSchedule = deliveryRow?.schedule || {};
        deliveryUpdates.schedule = { ...existingSchedule, _pickup: settings.pickup_enabled };
      }

      if (Object.keys(deliveryUpdates).length > 0) {
        deliveryUpdates.updated_at = new Date().toISOString();
        if (deliveryRow) {
          const { error } = await supabase
            .from('delivery_settings')
            .update(deliveryUpdates)
            .eq('id', deliveryRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('delivery_settings')
            .insert({
              mode: 'manual',
              manual_active: settings.delivery_enabled !== false,
              schedule: { _pickup: settings.pickup_enabled !== false },
              updated_at: new Date().toISOString(),
            });
          if (error) throw error;
        }
      }

      const [storeRowFinal, deliveryRowFinal] = await Promise.all([
        getRow(supabase, 'store_settings'),
        getRow(supabase, 'delivery_settings'),
      ]);

      return res.json({
        store_open: storeRowFinal?.store_open !== false,
        delivery_enabled: deliveryRowFinal?.manual_active !== false,
        pickup_enabled: deliveryRowFinal?.schedule?._pickup !== false,
      });
    }

    return res.status(400).json({ error: 'Unknown action. Use "get" or "update".' });
  } catch (error) {
    console.error('adminSettings error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
