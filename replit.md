# Mozzarella y Fuego

Online ordering and admin management platform for Mozzarella y Fuego, a Brazilian pizza restaurant in Barcelona. Customers browse the menu, customize pizzas, pay with Stripe, and track their orders in real time. Staff use an admin panel to manage orders, menu items, reservations, and store settings.

## Run & Operate

- Workflows are managed by Replit — use the workflow panel to start/stop services
- `pnpm run typecheck` — full typecheck across all packages
- Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Optional: `GOOGLE_MAPS_API_KEY` (used for real-time delivery distance/fee calculation)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v3 + react-router-dom v6
- API: Express 5 (`artifacts/api-server/`)
- Database: Supabase (Postgres) — accessed via `@supabase/supabase-js` from the API server
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

- **Supabase is the live database**: The app was ported from Base44 which used Supabase. All customer data (orders, menu items, reservations, settings) lives in Supabase. The Replit-provisioned Postgres (`lib/db/`) is scaffolded but unused — do not migrate unless explicitly requested.
- **Admin auth is a hardcoded password** (`mozzarellayfuego123`): The original app had no real OAuth for admin. This is intentional — changing it is a follow-up, not part of this port.
- **Base44 SDK fully removed**: `base44Client.js` is now a no-op stub; `app-params.js` is a stub. `AuthContext.jsx` was rewritten to fetch public settings from `/api/adminSettings` instead of the Base44 hosted SDK.
- **All API routes in one file**: `artifacts/api-server/src/routes/api.ts` contains all ported routes from the original `server.js` + `adminSettings.js` Vercel functions. Stripe webhook raw-body parsing is configured in `app.ts` before `express.json()`.
- **Frontend uses react-router-dom v6 BrowserRouter** (not wouter): The original app used react-router-dom; the scaffold used wouter. App.jsx (original) is loaded via App.tsx re-export to preserve the migration.

## Product

- **Landing page**: Hero image, about section, menu preview, location, reviews
- **Online ordering**: Menu browsing with category tabs, pizza customizer, cart, Stripe checkout, cash/pickup direct order
- **Order tracking**: Real-time status page for customers
- **Admin panel**: Orders dashboard, driver view, menu management (pizzas panel), delivery settings, reservation management, store open/close toggle
- **Reservations**: Customer-facing reservation form + admin management

## Gotchas

- Stripe webhook route (`POST /api/stripeWebhook`) requires raw body — configured in `artifacts/api-server/src/app.ts` before `express.json()`.
- `db.js` in the frontend calls `/api/supabaseProxy` (proxied by the Replit shared proxy to the api-server). Never use localhost directly in frontend code.
- `react-leaflet` and `react-quill` have peer dep warnings against React 19 (workspace uses React 18 via catalog). They work at runtime but show warnings during install.
- `tailwindcss-animate` is required by `tailwind.config.js` — it is installed in the frontend artifact's package.json.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
