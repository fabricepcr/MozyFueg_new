import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const supabase = createClient(rawUrl, serviceKey);

    const { data: result, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('sort_order', { ascending: true })
      .limit(200);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: result || [] });
  } catch (error) {
    console.error('menuItems error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});