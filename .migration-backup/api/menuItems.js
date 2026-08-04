import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('sort_order', { ascending: true })
      .limit(200);

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('menuItems error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
