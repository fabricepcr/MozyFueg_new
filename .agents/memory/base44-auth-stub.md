---
name: Base44 auth removed — stub files remain
description: base44Client.js and app-params.js are no-op stubs after the migration. Admin panel uses a simple server-side password check (original design).
---

After the Base44 → Replit port:

- `artifacts/mozzarella-fuego/src/api/base44Client.js` — no-op stub (exports empty `base44` object with noop methods)
- `artifacts/mozzarella-fuego/src/lib/app-params.js` — stub (all nulls)
- `artifacts/mozzarella-fuego/src/lib/AuthContext.jsx` — rewritten; fetches public settings from `/api/adminSettings` on mount; no OAuth

**Why:** The app has no real user auth. Admin panel gating is handled server-side via a password check. Base44's SDK auth was the only auth mechanism and it's gone.

**How to apply:** If adding real auth, use the `clerk-auth` or `replit-auth` skill and rewrite `AuthContext.jsx`. The stub's API surface (user, isAuthenticated, logout, navigateToLogin) matches what page components expect.
