# CLAUDE.md

## What This Is

Single-page React app serving personal tools at https://kyleacmooney.github.io/apps/. Uses HashRouter for GitHub Pages compatibility and Supabase for auth + data.

## Commands

```bash
npm run dev        # Dev server at localhost:5173/apps/
npm run build      # TypeScript check + Vite build to dist/
```

## Architecture

```
src/
  main.tsx                     # React root
  App.tsx                      # HashRouter + route definitions
  lib/supabase.ts              # Supabase client (anon key inline)
  context/AuthContext.tsx       # Google OAuth provider, useAuth() hook
  components/ProtectedRoute.tsx # Redirects to login if unauthenticated
  pages/Home.tsx               # Landing page with nav
  pages/Workouts.tsx           # Workout logging + exercise review
```

## Key Patterns

- **HashRouter** — routes are `/#/path`, avoids GitHub Pages 404 issues with client-side routing
- **Supabase anon key is public** — hardcoded in `lib/supabase.ts`, safe because Row Level Security on tables enforces access control
- **Auth flow:** `useAuth()` hook provides `user`, `signIn`, `signOut`. Wrap routes in `<ProtectedRoute>` to require login
- **Adding a new page:** Create `src/pages/NewPage.tsx`, add a `<Route>` in `App.tsx`, optionally wrap in `<ProtectedRoute>`
- **Vite base path** is `/apps/` (matches the GitHub repo name for correct asset resolution on GitHub Pages)

## Supabase

- Project: `claude-managed` (ID: `svmjtlsdyghxilpcdywc`)
- Auth: Google OAuth
- Tables: `exercises`, `workout_sessions`, `workout_exercises`, `workout_sets` — all RLS-enabled

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages. Workflow: `.github/workflows/deploy.yml`.
