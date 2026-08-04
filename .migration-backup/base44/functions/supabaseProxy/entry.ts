import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const rawUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '').replace(/\/rest\/v1$/, '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

    const supabase = createClient(rawUrl, serviceKey);

    const body = await req.json();
    const { action, table, data, query, id, updates } = body;

    if (action === 'insert') {
      const { data: result, error } = await supabase.from(table).insert(data).select().single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result });
    }

    if (action === 'insert_many') {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result });
    }

    if (action === 'update') {
      const { data: result, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result });
    }

    if (action === 'select') {
      let q = supabase.from(table).select('*');
      if (query) {
        for (const [col, val] of Object.entries(query)) {
          q = q.eq(col, val);
        }
      }
      const { data: result, error } = await q.order('created_at', { ascending: false }).limit(200);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result });
    }

    if (action === 'select_one') {
      let q = supabase.from(table).select('*');
      if (query) {
        for (const [col, val] of Object.entries(query)) {
          q = q.eq(col, val);
        }
      }
      const { data: result, error } = await q.limit(1).maybeSingle();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result || null });
    }

    if (action === 'upsert') {
      // Lee el id existente, si hay → update, si no → insert
      const { upsert_column } = body;
      const colVal = data[upsert_column];
      let existingId = null;
      if (upsert_column && colVal !== undefined) {
        const { data: existing } = await supabase.from(table).select('id').eq(upsert_column, colVal).maybeSingle();
        existingId = existing?.id || null;
      }
      if (existingId) {
        const { data: result, error } = await supabase.from(table).update(data).eq('id', existingId).select().single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ data: result });
      } else {
        const { data: result, error } = await supabase.from(table).insert(data).select().single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ data: result });
      }
    }

    if (action === 'delete_one') {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (action === 'delete_many') {
      const { ids } = body;
      if (!ids || !ids.length) return Response.json({ success: true });
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (action === 'delete_all') {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (action === 'delete_where') {
      // query es un objeto col→val, borra todas las filas que coincidan
      let q = supabase.from(table).delete();
      for (const [col, val] of Object.entries(query)) {
        q = q.eq(col, val);
      }
      const { error } = await q;
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (action === 'delete_ilike') {
      // Borra filas donde `col` contenga `val` (case-insensitive)
      const { col, val } = body;
      const { error } = await supabase.from(table).delete().ilike(col, `%${val}%`);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    if (action === 'select_names') {
      // Devuelve solo id+name de la tabla para depurar
      const { data: result, error } = await supabase.from(table).select('id,name').order('name');
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data: result });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('supabaseProxy error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});