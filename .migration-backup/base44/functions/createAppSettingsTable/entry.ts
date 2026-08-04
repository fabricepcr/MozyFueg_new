// One-time migration: creates the app_settings table in Supabase
Deno.serve(async (_req) => {
  try {
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

    // Extract project ref from URL (e.g. https://abcdefg.supabase.co → abcdefg)
    const projectRef = rawUrl.replace('https://', '').split('.')[0];

    // Use Supabase Management API v1 to run SQL
    const sql = `
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY,
        store_open BOOLEAN NOT NULL DEFAULT true,
        delivery_enabled BOOLEAN NOT NULL DEFAULT true,
        pickup_enabled BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO app_settings (id, store_open, delivery_enabled, pickup_enabled, updated_at)
      VALUES (1, true, true, true, now())
      ON CONFLICT (id) DO NOTHING;
    `;

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    const data = await res.json().catch(() => ({}));
    console.log('Management API response:', res.status, JSON.stringify(data));

    if (res.ok || res.status === 200) {
      return Response.json({ success: true, message: 'Table app_settings created or already exists', data });
    }

    // If Management API fails, try via pg RPC (if available)
    console.log('Management API failed, trying alternative...');

    // Supabase allows running raw SQL through the REST API with service role using Postgres functions
    // Try creating via a direct POST to the rpc endpoint with exec_sql
    const rpcRes = await fetch(`${rawUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });
    const rpcData = await rpcRes.json().catch(() => ({}));
    console.log('RPC response:', rpcRes.status, JSON.stringify(rpcData));

    return Response.json({
      managementApi: { status: res.status, data },
      rpc: { status: rpcRes.status, data: rpcData },
    });

  } catch (error) {
    console.error('createAppSettingsTable error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});