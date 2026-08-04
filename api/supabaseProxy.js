import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { action, table, data, query, id, updates } = req.body;

    if (action === 'insert') {
      const { data: result, error } = await supabase.from(table).insert(data).select().single();
      if (error) throw error;
      return res.json({ data: result });
    }

    if (action === 'update') {
      const { data: result, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.json({ data: result });
    }

    if (action === 'select') {
      let q = supabase.from(table).select('*');
      if (query) for (const [col, val] of Object.entries(query)) q = q.eq(col, val);
      const { data: result, error } = await q.order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return res.json({ data: result });
    }

    if (action === 'select_one') {
      let q = supabase.from(table).select('*');
      if (query) for (const [col, val] of Object.entries(query)) q = q.eq(col, val);
      const { data: result, error } = await q.limit(1).single();
      if (error?.code !== 'PGRST116' && error) throw error;
      return res.json({ data: result || null });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('supabaseProxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
