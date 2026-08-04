---
name: Replit Postgres migration
description: The app was fully migrated from Supabase to the built-in Replit Postgres database. No Supabase secrets are needed.
---

The app started on Supabase and was migrated to Replit Postgres (accessed via DATABASE_URL).

**What changed:**
- `lib/db/src/schema/index.ts` — defines 5 tables: orders, menu_items, store_settings, delivery_settings, reservations
- `artifacts/api-server/src/routes/api.ts` — all routes use `pool` from `@workspace/db` with raw parameterized SQL; no Supabase client
- `artifacts/mozzarella-fuego/src/lib/supabase.jsx` — safe no-op stub (kept for legacy imports in Profile.jsx and api.js that are unreachable)
- `AdminOrders.jsx` — Supabase Realtime removed; uses 8-second polling + visibility-change refresh instead
- `Reservations.jsx` — uses `db.insert('reservations', ...)` via the proxy instead of direct Supabase insert

**Why:** User explicitly requested Replit-only stack ("replit 100%").

**How to apply:**
- Do not reference SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; they are not set and not needed
- To push schema changes: `pnpm --filter @workspace/db run push`
- The NUMERIC type parser is set in `lib/db/src/index.ts` so numeric columns come back as JS numbers
- `singleton_key = 'main'` is used for store_settings and delivery_settings upserts (one row each)
- `lib/db/import-from-supabase.mjs` was the one-time migration script; it can be re-run safely (uses ON CONFLICT DO UPDATE)
- The `/api/supabaseProxy` endpoint name is preserved for frontend compatibility even though it now talks to Postgres
