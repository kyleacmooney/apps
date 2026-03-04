# Apps

Personal web apps hosted on GitHub Pages with Supabase backend.

**Live:** https://kyleacmooney.github.io/apps/

## Stack

- **Frontend:** React 19, TypeScript, Vite
- **Routing:** HashRouter (client-side, no server config needed)
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Auth:** Google OAuth via Supabase Auth
- **Deploy:** GitHub Actions → GitHub Pages on push to `main`

## Pages

| Route | Description | Auth required |
|-------|-------------|---------------|
| `/#/` | Home / landing | No |
| `/#/workouts` | Workout logging and exercise review | Yes |

## Development

```bash
npm install
npm run dev        # http://localhost:5173/apps/
npm run build      # outputs to dist/
```

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which builds and deploys to GitHub Pages automatically. No manual steps needed.

## Supabase

Project: `claude-managed` (`svmjtlsdyghxilpcdywc`)

### Tables used

- `exercises` — exercise encyclopedia (name, category, form cues, progression)
- `workout_sessions` — date, type, energy level, notes
- `workout_exercises` — exercises within a session, with ordering and section
- `workout_sets` — sets within an exercise (reps, weight, duration, PR flag)

All tables use Row Level Security. The Supabase anon key is embedded client-side (this is safe — RLS enforces access control).
