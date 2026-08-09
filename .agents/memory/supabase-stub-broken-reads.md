---
name: Supabase stub breaks all browser-side data reads
description: The supabase.jsx client is a no-op stub — any call to supabase.from().select() silently returns { data: null }. All browser-side data fetching must use fetch('/api/...') instead.
---

## Rule
Never use `supabase.from(...)` in browser-side (src/) code. The `supabase.jsx` export is a deliberate no-op stub — every call returns `{ data: null, error: null }` without hitting the network.

## Why
The app was migrated from Supabase to Replit Postgres. The stub was left in place to prevent import errors from files not yet migrated, but it silently returns empty data which manifests as blank menus, broken store settings, etc.

## How to apply
- All data reads in `src/` must use `fetch('/api/<endpoint>')` against the Express API server.
- The Replit proxy routes `/api/*` from the browser to the api-server artifact (port 8080).
- `fetchMenuItems` → `GET /api/menuItems` → returns `{ data: [...] }`
- `fetchStoreSettings` → `POST /api/adminSettings` with `{ action: 'getPublicSettings' }` → returns `{ data: { storeOpen, deliveryActive, pickupActive } }`
- Order creation → `POST /api/supabaseProxy` with `{ action: 'insert', table: 'orders', data: {...} }` — this route IS on Postgres.
- `useStoreSettings` previously sent `action: 'get'` (wrong) — correct action is `'getPublicSettings'`.
