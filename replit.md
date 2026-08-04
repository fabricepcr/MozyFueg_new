# Mozzarella y Fuego

Online ordering and admin management platform for Mozzarella y Fuego, a Brazilian pizza restaurant in Barcelona. Customers browse the menu, customize pizzas, pay with Stripe, and track their orders in real time. Staff use an admin panel to manage orders, menu items, reservations, and store settings.

## Run & Operate

- Workflows are managed by Replit — use the workflow panel to start/stop services
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push schema changes to Replit Postgres
- Required secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Supabase no longer needed)
- Optional: `GOOGLE_MAPS_API_KEY` (used for real-time delivery distance/fee calculation)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v3 + react-router-dom v6
- API: Express 5 (`artifacts/api-server/`)
- Database: Replit Postgres (`DATABASE_URL`) — Drizzle ORM schema in `lib/db/`, raw SQL via `pool` in API routes
- Payments: Stripe Checkout + webhooks
- Build: esbuild (API server), Vite (frontend)

## Where things live

- `artifacts/mozzarella-fuego/` — React frontend (Vite, Tailwind v3, JSX)
  - `src/pages/` — route-level components (Home, OrderMenu, Checkout, Admin*, Driver, etc.)
  - `src/components/` — shared UI components; `admin/` and `order/` subdirs
  - `src/lib/db.js` — Supabase CRUD client (calls `/api/supabaseProxy`)
  - `src/lib/AuthContext.jsx` — minimal auth context stub (app uses admin password, not OAuth)
  - `src/index.css` — Tailwind v3 theme: terracotta primary, Cormorant Garamond + DM Sans
- `artifacts/api-server/` — Express API server
  - `src/routes/api.ts` — all business routes (menu, checkout, orders, Stripe, admin settings)
  - `src/routes/health.ts` — `/api/healthz`
- `lib/db/` — Drizzle ORM schema (Replit Postgres — not used yet; app uses Supabase)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (codegen: `pnpm --filter @workspace/api-spec run codegen`)

## Architecture decisions

- **Replit Postgres is the live database**: All data lives in the built-in Replit Postgres. Schema is in `lib/db/src/schema/index.ts` (5 tables). Push changes with `pnpm --filter @workspace/db run push`. The 49 real menu items were imported from the old Supabase project via `lib/db/import-from-supabase.mjs`.
- **No Supabase**: `@supabase/supabase-js` is removed from all packages. `src/lib/supabase.jsx` is a safe no-op stub for legacy imports. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are not needed.
- **Generic CRUD proxy name preserved**: The `/api/supabaseProxy` endpoint name is kept so the frontend `db.js` works without changes. It now runs parameterized SQL against Replit Postgres.
- **Admin auth is a hardcoded password**: The admin panel checks a known password server-side. Real auth is a future improvement.
- **Admin orders panel uses polling only**: Supabase Realtime was removed. The panel polls every 8 seconds and also refreshes on tab focus/reconnect via visibility-change listeners.
- **All API routes in one file**: `artifacts/api-server/src/routes/api.ts`. Stripe webhook raw-body parsing is in `app.ts` before `express.json()`.
- **NUMERIC columns return as JS numbers**: `lib/db/src/index.ts` sets `pg.types.setTypeParser(1700, parseFloat)` so numeric columns arrive as numbers, not strings.

## Product

- **Landing page**: Hero image, about section, menu preview, location, reviews
- **Online ordering**: Menu browsing with category tabs, pizza customizer, cart, Stripe checkout, cash/pickup direct order
- **Order tracking**: Real-time status page for customers
- **Admin panel**: Orders dashboard, driver view, menu management (pizzas panel), delivery settings, reservation management, store open/close toggle
- **Reservations**: Customer-facing reservation form + admin management

## Gotchas

- Stripe webhook route (`POST /api/stripeWebhook`) requires raw body — configured in `artifacts/api-server/src/app.ts` before `express.json()`.
- `db.js` in the frontend calls `/api/supabaseProxy` — endpoint name preserved for compatibility. Never use localhost in frontend code.
- `singleton_key = 'main'` enforces one row for store_settings and delivery_settings via UNIQUE + ON CONFLICT upsert.
- `react-leaflet` and `react-quill` have peer dep warnings against React 19. They work at runtime.
- `tailwindcss-animate` is required by `tailwind.config.js` — it is installed in the frontend artifact's package.json.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
