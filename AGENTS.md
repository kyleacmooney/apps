# AGENTS.md

## Cursor Cloud specific instructions

This is a single-service React SPA — no backend, Docker, or database setup needed locally.

- **Dev server:** `npm run dev` serves at `http://localhost:5173/apps/` (HashRouter, so routes are `/#/path`)
- **Build / type-check:** `npm run build` runs `tsc -b && vite build`
- **No dedicated lint script** — TypeScript type-checking via `tsc -b` (part of `npm run build`) is the primary static analysis
- **Supabase is cloud-hosted** — the anon key is hardcoded in `lib/supabase.ts`; no local Supabase instance required. Auth (Google OAuth) and data features require a logged-in session but the app loads and navigates without one.
- **Supabase CLI** is installed globally (`supabase` command). Authenticated via `SUPABASE_ACCESS_TOKEN` env var (injected as a secret). Project ID is `svmjtlsdyghxilpcdywc`.
- **Auto-merge branch cleanup:** When working locally on this computer and pushing a `claude/*`, `cursor/*`, or `codex/*` branch intended for the auto-merge workflow, switch back to `main` and delete the local feature branch after the push succeeds. Do not leave the local checkout on the ephemeral auto-merge branch unless the user explicitly asks.
- **Start-of-work sync:** When starting work on a new request in this repo on this computer, pull the latest changes from GitHub before making edits so local work begins from the freshest branch state.
- See `CLAUDE.md` for full architecture, patterns, and Supabase details
