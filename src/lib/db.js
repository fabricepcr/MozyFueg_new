/**
 * db.js — Helper centralizado para operaciones de base de datos.
 * Llama al proxy Vercel /api/supabaseProxy (funciona tanto en Vercel como en local).
 */

async function proxy(payload) {
  const res = await fetch('/api/supabaseProxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (json?.error) throw new Error(json.error);
  return json?.data ?? null;
}

export const db = {
  select: (table, query) => proxy({ action: 'select', table, query }),
  selectOne: (table, query) => proxy({ action: 'select_one', table, query }),
  insert: (table, data) => proxy({ action: 'insert', table, data }),
  update: (table, id, updates) => proxy({ action: 'update', table, id, updates }),
  upsert: (table, data, upsert_column) => proxy({ action: 'upsert', table, data, upsert_column }),
  deleteOne: (table, id) => proxy({ action: 'delete_one', table, id }),
  deleteMany: (table, ids) => proxy({ action: 'delete_many', table, ids }),
  deleteAll: (table) => proxy({ action: 'delete_all', table }),
};