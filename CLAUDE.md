# CLAUDE.md

## What This Is

Mobile-first single-page React app serving personal tools at https://kyleacmooney.github.io/apps/. Uses HashRouter for GitHub Pages compatibility and Supabase for auth + data. All UI decisions should prioritize touch interactions, thumb-reachable layouts, and mobile viewport ergonomics. Intended to be used as a standalone PWA via Safari "Add to Home Screen" on iPhone — `apple-mobile-web-app-capable` and `manifest.json` (display: standalone) are configured in `index.html`. Route persistence across app suspensions is handled by `RouteRestorer` (saves the current path to localStorage).

## Commands

```bash
npm run dev        # Dev server at localhost:5173/apps/
npm run build      # TypeScript check + Vite build to dist/
```

## Architecture

```
src/
  main.tsx                     # React root
  index.css                    # Tailwind CSS v4 + dark theme variables
  App.tsx                      # HashRouter + route definitions
  lib/supabase.ts              # Supabase client (anon key inline)
  lib/utils.ts                 # cn() utility for Tailwind class merging
  lib/categories.ts            # Exercise category colors and utilities
  lib/workout-utils.ts         # Workout formatting helpers (set display, relative dates)
  context/AuthContext.tsx       # Google OAuth provider, useAuth() hook
  context/SupabaseContext.tsx   # Dynamic Supabase client — useDataClient() for data queries, useSupabaseSettings() for config
  components/ProtectedRoute.tsx # Redirects to login if unauthenticated
  lib/plant-types.ts           # TypeScript interfaces for plant domain
  lib/plant-care-algorithm.ts  # Smart watering interval computation
  lib/plant-utils.ts           # Care type labels, icons, colors, formatting
  lib/use-persisted-state.ts   # usePersistedState hook — localStorage-backed useState for iOS PWA state survival
  components/RouteRestorer.tsx  # Saves/restores current route + scroll position across app suspensions
  components/ui/               # shadcn/ui components (accordion, badge, button, card, dialog, dropdown-menu, input, label, select, separator, switch, tabs, textarea)
  pages/Home.tsx               # Landing page with nav cards
  pages/Exercises.tsx          # Exercise encyclopedia with search/filters
  pages/Workouts.tsx           # Workout session history
  pages/Plants.tsx             # Plant care tracker (first write-capable feature)
  pages/Settings.tsx           # Backend configuration — connect your own Supabase project
  pages/Chat.tsx               # In-app AI chat — streams Claude responses via edge function
docs/
  workout-logging-instructions.md  # Claude.ai prompt for logging workouts to Supabase
  plant-care-instructions.md       # Claude.ai prompt for researching plants + updating Supabase
supabase/
  config.toml                      # Supabase CLI project config (local dev settings)
  migrations/                      # All DDL migrations (applied via MCP or CLI)
  functions/                       # Edge function source code (one dir per function)
    proxy-image-upload/index.ts    # Downloads external images → Supabase Storage
    chat/index.ts                  # AI chat — proxies streaming Claude API calls via OAuth token
```

## Key Patterns

- **HashRouter** — routes are `/#/path`, avoids GitHub Pages 404 issues with client-side routing
- **Supabase anon key is public** — hardcoded in `lib/supabase.ts`, safe because Row Level Security on tables enforces access control
- **Auth flow:** `useAuth()` hook provides `user`, `signIn`, `signOut`. Wrap routes in `<ProtectedRoute>` to require login. Auth always uses the shared Supabase (Kyle's).
- **Dynamic data client:** All data queries use `useDataClient()` from `SupabaseContext` — returns the shared Supabase client by default, or a user's own Supabase client if configured in Settings. Never import `supabase` directly in page components; always use the hook. `useSupabaseSettings()` provides `saveExternalBackend()`, `clearExternalBackend()`, and connection state.
- **Adding a new page:** Create `src/pages/NewPage.tsx`, add a `<Route>` in `App.tsx`, optionally wrap in `<ProtectedRoute>`
- **Vite base path** is `/apps/` (matches the GitHub repo name for correct asset resolution on GitHub Pages)
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin, dark theme colors defined in `src/index.css`
- **shadcn/ui** — component primitives in `components/ui/`, installed via `npx shadcn@latest add <component>`
- **Category colors** — defined as Tailwind theme variables in `index.css`, mapped to class names in `lib/categories.ts`
- **State persistence for PWA** — this app must feel native on iPhone. Use `usePersistedState` (from `lib/use-persisted-state.ts`) instead of `useState` for any user-facing UI state that should survive iOS app suspensions: expanded items, active tabs, filters, selections, dialog open states, and **form inputs** (so partial progress isn't lost). Route + scroll position are handled by `RouteRestorer`. Only use regular `useState` for truly transient state like loading spinners, animation flags, and debounce timers. When a form is submitted or explicitly cancelled, reset persisted fields to defaults (the setter from `usePersistedState` writes through to localStorage automatically).
- **Path alias** — `@/` maps to `src/` (configured in vite.config.ts and tsconfig)

## Supabase

- **Tooling:** Claude Code has access to both the Supabase MCP server and the Supabase CLI (`supabase` command via Bash)
- Project: `claude-managed` (ID: `svmjtlsdyghxilpcdywc`)
- Auth: Google OAuth
- **Multi-user:** All tables have `user_id` columns with RLS policies enforcing `auth.uid() = user_id`. Views use `security_invoker = true` so RLS applies to the calling user. Exercises are per-user (unique constraint on `(user_id, name)`). `workout_exercises` and `workout_sets` inherit user scoping via FK chain to `workout_sessions`.
- Tables: `exercises`, `workout_sessions`, `workout_exercises`, `workout_sets`, `rooms`, `plants`, `care_schedules`, `care_logs`, `species_profiles`, `user_settings` — all RLS-enabled
- **`user_settings`:** Stores per-user external Supabase config (`external_supabase_url`, `external_supabase_anon_key`). Always on the shared Supabase, never on a user's external project. One row per user via unique constraint on `user_id`.
- Edge Functions: `proxy-image-upload` (downloads external image URLs and self-hosts them in Supabase Storage, updating `species_profiles.image_url`), `chat` (proxies streaming Claude API calls using `CLAUDE_CODE_OAUTH_TOKEN` secret with Bearer auth + `anthropic-beta: oauth-2025-04-20` header)
- Storage: `plant-photos` bucket (public read) — stores species reference images under `species/` and user-uploaded plant photos
- `species_profiles` is the primary source of species data, populated by Claude.ai via `docs/plant-care-instructions.md`
- **Workout logging instructions** (used in Claude.ai conversations): [`docs/workout-logging-instructions.md`](docs/workout-logging-instructions.md)
- **Plant care instructions** (used in Claude.ai conversations): [`docs/plant-care-instructions.md`](docs/plant-care-instructions.md)

### Dual-auth model (shared + external)

- **Shared Supabase (Kyle&rsquo;s project):** The app uses Google Identity Services (GIS) in the browser to obtain a Google ID token, then calls `supabase.auth.signInWithIdToken({ provider: 'google', token })` on the shared project. This is the canonical source of `auth.uid()` for the app.
- **External Supabase (user project):** If a user configures their own Supabase URL + anon key in Settings, `SupabaseContext` creates a second client for data access. After a successful Google sign-in, it will also attempt `signInWithIdToken` against the external project using the same GIS ID token.
- If the external project is **not** configured for Google OAuth (or the sign-in fails), the external client cleanly falls back to anon-only access while the shared backend remains fully authenticated. `authMode` from `useSupabaseSettings()` reports whether the data client is `shared-only`, `external-authed`, or `external-anon`.
- The setup wizard (`Setup` page) offers two schema modes for external projects:
  - **Simple (no auth):** Run `docs/schema.sql` only — permissive RLS, suitable for single-user setups where the anon key is effectively private.
  - **Secure (auth-enabled):** Run `docs/schema.sql` and then `docs/schema-auth.sql` after enabling the Google provider on the user&rsquo;s Supabase project with the shared Google client ID. This mode mirrors Kyle&rsquo;s shared project: RLS uses `auth.uid()` for row ownership, and both the app and Claude (via the Supabase MCP) authenticate with the same Google identity.

### Version Control Convention

**All Supabase resources must be version-controlled in the `supabase/` directory.** The deployed state of Supabase should always be reproducible from this repo.

- **Migrations** (`supabase/migrations/`): Every DDL change (schema, RLS policies, storage buckets, extensions) must have a corresponding `.sql` file. When applying migrations via the Supabase MCP `apply_migration` tool, always write the same SQL to `supabase/migrations/<version>_<name>.sql` and commit it. The version timestamp and name should match what's recorded in Supabase's migration history.
- **Edge Functions** (`supabase/functions/<function-name>/`): Every deployed edge function must have its source checked into the repo. After deploying via `deploy_edge_function` MCP tool or `supabase functions deploy`, ensure the source files are committed. One directory per function, matching the function slug.
- **Config** (`supabase/config.toml`): Supabase CLI project configuration. Update when changing local dev settings.
- **What's NOT versioned**: Data (seed files are optional), secrets/env vars, `.temp/` state (gitignored).

## Preview Verification

When using `preview_*` tools to verify changes:
- The dev server URL is `http://localhost:5173/apps/` with HashRouter routes (e.g., `/#/workouts`)
- The preview browser may start on `chrome-error://chromewebdata/` — navigate explicitly via `preview_eval` with `window.location.href = 'http://localhost:5173/apps/#/workouts'`
- Most pages are behind `<ProtectedRoute>` (Google OAuth). The preview browser may already have an authenticated session — try navigating before assuming auth will block you
- If the page is blank/dark, check `preview_eval` for `window.location.href` to confirm you're on the right URL

## Deployment

- Push to `main` → GitHub Actions builds and deploys to GitHub Pages. Workflow: `.github/workflows/deploy.yml`.
- **Auto-merge:** Pushes to `claude/*` branches are automatically fast-forward merged to `main` and the branch is deleted. Workflow: `.github/workflows/auto-merge-claude.yml`. This means every push you make gets deployed — treat each push as a production deploy.
