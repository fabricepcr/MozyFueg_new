/* eslint-env node */
/* global require, module, process */
const { createClient } = require('@supabase/supabase-js');

const ADMIN_PASSWORD = 'mozzarellayfuego123';

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const supabase = getSupabase();

    // Parsear body manualmente si Vercel no lo hace automáticamente
    let body = req.body;
    if (!body || typeof body === 'string') {
      try {
        const raw = typeof body === 'string' ? body : await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
    }

    const { action, password, key, value } = body;

    // ── Public read ───────────────────────────────────────────────────────────
    if (action === 'getPublicSettings') {
      const [{ data: storeArr }, { data: deliveryArr }] = await Promise.all([
        supabase.from('store_settings').select('store_open').limit(1),
        supabase.from('delivery_settings').select('manual_active, pickup_active').limit(1),
      ]);
      const storeOpen = storeArr?.[0]?.store_open !== false;
      const deliveryActive = deliveryArr?.[0]?.manual_active !== false;
      // pickup_active: si el campo no existe en BD aún, default true
      const pickupActive = deliveryArr?.[0]?.pickup_active !== false;
      return res.json({ data: { storeOpen, deliveryActive, pickupActive } });
    }

    // ── Auth required ─────────────────────────────────────────────────────────
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── updateSetting (single key/value toggle) ───────────────────────────────
    if (action === 'updateSetting') {
      const val = value === true || value === 'true';

      if (key === 'store_open') {
        const { data: existing } = await supabase.from('store_settings').select('id').limit(1);
        const id = existing?.[0]?.id;
        if (id) {
          await supabase.from('store_settings').update({ store_open: val }).eq('id', id);
        } else {
          await supabase.from('store_settings').insert({ store_open: val, singleton_key: 'main' });
        }
        return res.json({ data: { key, value: val } });
      }

      if (key === 'delivery_active' || key === 'pickup_active') {
        const { data: existing } = await supabase.from('delivery_settings').select('id, manual_active, pickup_active').limit(1);
        const row = existing?.[0];
        const updates = {};
        if (key === 'delivery_active') updates.manual_active = val;
        if (key === 'pickup_active') updates.pickup_active = val;

        if (row?.id) {
          const { error } = await supabase.from('delivery_settings').update(updates).eq('id', row.id);
          if (error) {
            console.error('delivery_settings update error:', error.message);
            return res.status(500).json({ error: error.message });
          }
        } else {
          const { error } = await supabase.from('delivery_settings').insert({
            mode: 'manual',
            manual_active: key === 'delivery_active' ? val : true,
            pickup_active: key === 'pickup_active' ? val : true,
            singleton_key: 'main',
          });
          if (error) {
            console.error('delivery_settings insert error:', error.message);
            return res.status(500).json({ error: error.message });
          }
        }
        return res.json({ data: { key, value: val } });
      }

      return res.status(400).json({ error: 'Unknown key' });
    }

    // ── updateAllSettings — guarda delivery y pickup en una sola llamada ───────
    if (action === 'updateAllSettings') {
      const deliveryVal = value?.delivery_active === true || value?.delivery_active === 'true';
      const pickupVal = value?.pickup_active === true || value?.pickup_active === 'true';

      // Leer el registro existente
      const { data: existing, error: fetchErr } = await supabase
        .from('delivery_settings')
        .select('id')
        .limit(1);

      if (fetchErr) {
        console.error('fetch error:', fetchErr.message);
        return res.status(500).json({ error: fetchErr.message });
      }

      const row = existing?.[0];

      if (row?.id) {
        // Intentar update con pickup_active; si falla por columna, intentar sin él
        const { error: e1 } = await supabase
          .from('delivery_settings')
          .update({ manual_active: deliveryVal, pickup_active: pickupVal })
          .eq('id', row.id);

        if (e1) {
          console.error('update with pickup_active failed:', e1.message, '— retrying without it');
          // Columna pickup_active puede no existir, guardar solo manual_active
          const { error: e2 } = await supabase
            .from('delivery_settings')
            .update({ manual_active: deliveryVal })
            .eq('id', row.id);
          if (e2) {
            console.error('update without pickup_active also failed:', e2.message);
            return res.status(500).json({ error: e2.message });
          }
        }
      } else {
        // No existe registro — insertar
        const { error: e1 } = await supabase
          .from('delivery_settings')
          .insert({ mode: 'manual', singleton_key: 'main', manual_active: deliveryVal, pickup_active: pickupVal });

        if (e1) {
          console.error('insert with pickup_active failed:', e1.message, '— retrying without it');
          const { error: e2 } = await supabase
            .from('delivery_settings')
            .insert({ mode: 'manual', singleton_key: 'main', manual_active: deliveryVal });
          if (e2) {
            console.error('insert without pickup_active also failed:', e2.message);
            return res.status(500).json({ error: e2.message });
          }
        }
      }

      return res.json({ data: { delivery_active: deliveryVal, pickup_active: pickupVal } });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('adminSettings error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};