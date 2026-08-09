// API client — calls the Replit Postgres backend via /api/*
// (The old Supabase client was replaced with a no-op stub; all data goes through Express.)

export const fetchMenuItems = async () => {
  const res = await fetch('/api/menuItems');
  if (!res.ok) throw new Error(`menuItems fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
};

export const fetchToppings = async () => {
  const res = await fetch('/api/toppings');
  if (!res.ok) throw new Error(`toppings fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
};
