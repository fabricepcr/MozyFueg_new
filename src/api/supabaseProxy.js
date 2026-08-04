/* eslint-env node */
/* global require, module, process */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const supabase = createClient(rawUrl, serviceKey);

    const { action, table, data, query, id, updates } = req.body;

    if (action === 'upsert') {
      // Manual upsert: check if row exists, then update or insert
      const { upsert_column } = req.body;
      const colVal = data[upsert_column];
      const { data: existing, error: selErr } = await supabase.from(table).select('id').eq(upsert_column, colVal).maybeSingle();
      if (selErr) return res.status(500).json({ error: selErr.message });
      if (existing?.id) {
        const { data: result, error: updErr } = await supabase.from(table).update(data).eq('id', existing.id).select().single();
        if (updErr) return res.status(500).json({ error: updErr.message });
        return res.json({ data: result });
      } else {
        const { data: result, error: insErr } = await supabase.from(table).insert(data).select().single();
        if (insErr) return res.status(500).json({ error: insErr.message });
        return res.json({ data: result });
      }
    }

    if (action === 'insert') {
      const { data: result, error } = await supabase.from(table).insert(data).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: result });
    }

    if (action === 'insert_many') {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: result });
    }

    if (action === 'update') {
      const { data: result, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: result });
    }

    if (action === 'delete_one') {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (action === 'select') {
      let q = supabase.from(table).select('*');
      if (query) {
        for (const [col, val] of Object.entries(query)) {
          q = q.eq(col, val);
        }
      }
      const { data: result, error } = await q.order('created_at', { ascending: false }).limit(200);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: result });
    }

    if (action === 'select_one') {
      let q = supabase.from(table).select('*');
      if (query) {
        for (const [col, val] of Object.entries(query)) {
          q = q.eq(col, val);
        }
      }
      const { data: result, error } = await q.limit(1).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: result || null });
    }

    if (action === 'delete_all') {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (action === 'delete_many') {
      // ids: array of UUIDs to delete
      const { ids } = req.body;
      if (!ids || !ids.length) return res.json({ success: true });
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('supabaseProxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}