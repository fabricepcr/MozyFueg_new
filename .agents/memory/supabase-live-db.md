---
name: Supabase is the live database
description: The app uses an external Supabase instance, not Replit's built-in Postgres. All customer data lives there.
---

The ported Base44 app connects to an external Supabase Postgres instance via `@supabase/supabase-js` in the api-server. The Replit-provisioned Postgres (`lib/db/` with Drizzle ORM) is present in the scaffold but **not used by any app code**.

**Why:** The original Base44 app stored everything in Supabase. Migrating that data to Replit Postgres was out of scope for the initial port.

**How to apply:** If someone asks to "use the database" or "add a table", clarify whether they mean Supabase (existing data) or Replit Postgres (Drizzle schema). Do not run `pnpm --filter @workspace/db run push` and expect it to affect live data — it targets Replit Postgres only.

Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
