import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Try to read store_settings table directly
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1);

    return Response.json({ data, error: error?.message || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});