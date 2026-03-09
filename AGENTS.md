# AGENTS.md

## Cursor Cloud specific instructions

This is a single-service React SPA — no backend, Docker, or database setup needed locally.

- **Dev server:** `npm run dev` serves at `http://localhost:5173/apps/` (HashRouter, so routes are `/#/path`)
- **Build / type-check:** `npm run build` runs `tsc -b && vite build`
- **No dedicated lint script** — TypeScript type-checking via `tsc -b` (part of `npm run build`) is the primary static analysis
- **Supabase is cloud-hosted** — the anon key is hardcoded in `lib/supabase.ts`; no local Supabase instance required. Auth (Google OAuth) and data features require a logged-in session but the app loads and navigates without one.
- See `CLAUDE.md` for full architecture, patterns, and Supabase details
