# CLAUDE.md

## What This Is

Mobile-first single-page React app serving personal tools at https://kyleacmooney.github.io/apps/. Uses HashRouter for GitHub Pages compatibility and Supabase for auth + data. All UI decisions should prioritize touch interactions, thumb-reachable layouts, and mobile viewport ergonomics.

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
  components/ProtectedRoute.tsx # Redirects to login if unauthenticated
  components/ui/               # shadcn/ui components (accordion, badge, button, card, input)
  pages/Home.tsx               # Landing page with nav cards
  pages/Exercises.tsx          # Exercise encyclopedia with search/filters
  pages/Workouts.tsx           # Workout session history
docs/
  workout-logging-instructions.md  # Claude.ai prompt for logging workouts to Supabase
```

## Key Patterns

- **HashRouter** — routes are `/#/path`, avoids GitHub Pages 404 issues with client-side routing
- **Supabase anon key is public** — hardcoded in `lib/supabase.ts`, safe because Row Level Security on tables enforces access control
- **Auth flow:** `useAuth()` hook provides `user`, `signIn`, `signOut`. Wrap routes in `<ProtectedRoute>` to require login
- **Adding a new page:** Create `src/pages/NewPage.tsx`, add a `<Route>` in `App.tsx`, optionally wrap in `<ProtectedRoute>`
- **Vite base path** is `/apps/` (matches the GitHub repo name for correct asset resolution on GitHub Pages)
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin, dark theme colors defined in `src/index.css`
- **shadcn/ui** — component primitives in `components/ui/`, installed via `npx shadcn@latest add <component>`
- **Category colors** — defined as Tailwind theme variables in `index.css`, mapped to class names in `lib/categories.ts`
- **Path alias** — `@/` maps to `src/` (configured in vite.config.ts and tsconfig)

## Supabase

- Project: `claude-managed` (ID: `svmjtlsdyghxilpcdywc`)
- Auth: Google OAuth
- Tables: `exercises`, `workout_sessions`, `workout_exercises`, `workout_sets` — all RLS-enabled
- **Workout logging instructions** (used in Claude.ai conversations): [`docs/workout-logging-instructions.md`](docs/workout-logging-instructions.md)

## Preview Verification

When using `preview_*` tools to verify changes:
- The dev server URL is `http://localhost:5173/apps/` with HashRouter routes (e.g., `/#/workouts`)
- The preview browser may start on `chrome-error://chromewebdata/` — navigate explicitly via `preview_eval` with `window.location.href = 'http://localhost:5173/apps/#/workouts'`
- Most pages are behind `<ProtectedRoute>` (Google OAuth). The preview browser may already have an authenticated session — try navigating before assuming auth will block you
- If the page is blank/dark, check `preview_eval` for `window.location.href` to confirm you're on the right URL

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages. Workflow: `.github/workflows/deploy.yml`.
