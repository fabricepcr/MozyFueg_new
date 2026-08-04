// Manages store settings using existing Supabase tables:
// - store_settings.store_open          → tienda abierta/cerrada
// - delivery_settings.manual_active    → delivery activo/inactivo
// - delivery_settings.schedule._pickup → recogida activa/inactiva (stored inside existing JSON field)

const ADMIN_PASSWORD = 'mozzarellayfuego123';

function supabaseHeaders() {
  const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const base = `${rawUrl}/rest/v1`;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  return { base, headers };
}

async function supabaseGet(table: string) {
  const { base, headers } = supabaseHeaders();
  const res = await fetch(`${base}/${table}?select=*&order=updated_at.desc&limit=1`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${table} failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

async function supabaseUpdate(table: string, id: string, data: Record<string, unknown>) {
  const { base, headers } = supabaseHeaders();
  const res = await fetch(`${base}/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UPDATE ${table} failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return rows[0];
}

async function supabaseInsert(table: string, data: Record<string, unknown>) {
  const { base, headers } = supabaseHeaders();
  const res = await fetch(`${base}/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`INSERT ${table} failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return rows[0];
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, password, settings } = body;

    // ── Public read ─────────────────────────────────────────────────────────
    if (action === 'get') {
      const [storeRow, deliveryRow] = await Promise.all([
        supabaseGet('store_settings'),
        supabaseGet('delivery_settings'),
      ]);

      // pickup_active is stored in schedule._pickup (boolean), defaults true
      const pickupEnabled = deliveryRow?.schedule?._pickup !== false;

      return Response.json({
        store_open: storeRow?.store_open !== false,
        delivery_enabled: deliveryRow?.manual_active !== false,
        pickup_enabled: pickupEnabled,
      });
    }

    // ── Admin write ──────────────────────────────────────────────────────────
    if (action === 'update') {
      if (password !== ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!settings || typeof settings !== 'object') {
        return Response.json({ error: 'Missing settings object' }, { status: 400 });
      }

      // 1. Update store_settings (store_open)
      if (typeof settings.store_open === 'boolean') {
        const storeRow = await supabaseGet('store_settings');
        if (storeRow) {
          await supabaseUpdate('store_settings', storeRow.id, { store_open: settings.store_open });
        } else {
          await supabaseInsert('store_settings', { store_open: settings.store_open });
        }
      }

      // 2. Update delivery_settings
      const deliveryRow = await supabaseGet('delivery_settings');
      const deliveryUpdates: Record<string, unknown> = {};

      if (typeof settings.delivery_enabled === 'boolean') {
        deliveryUpdates.manual_active = settings.delivery_enabled;
      }

      // Merge pickup_active into existing schedule JSON as _pickup key
      if (typeof settings.pickup_enabled === 'boolean') {
        const existingSchedule = deliveryRow?.schedule || {};
        deliveryUpdates.schedule = { ...existingSchedule, _pickup: settings.pickup_enabled };
      }

      if (Object.keys(deliveryUpdates).length > 0) {
        if (deliveryRow) {
          await supabaseUpdate('delivery_settings', deliveryRow.id, deliveryUpdates);
        } else {
          await supabaseInsert('delivery_settings', {
            mode: 'manual',
            manual_active: settings.delivery_enabled !== false,
            schedule: { _pickup: settings.pickup_enabled !== false },
          });
        }
      }

      // Re-read to confirm saved values
      const [storeRowFinal, deliveryRowFinal] = await Promise.all([
        supabaseGet('store_settings'),
        supabaseGet('delivery_settings'),
      ]);

      const result = {
        store_open: storeRowFinal?.store_open !== false,
        delivery_enabled: deliveryRowFinal?.manual_active !== false,
        pickup_enabled: deliveryRowFinal?.schedule?._pickup !== false,
      };

      console.log('Settings updated:', JSON.stringify(result));
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action. Use "get" or "update".' }, { status: 400 });

  } catch (error) {
    console.error('storeSettings error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});