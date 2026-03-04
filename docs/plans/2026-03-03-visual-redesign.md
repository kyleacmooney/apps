# Visual Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all pages (Home, Exercises, Workouts) with a polished dark theme using shadcn/ui + Tailwind CSS v4, mobile-first.

**Architecture:** Add Tailwind CSS v4 via the `@tailwindcss/vite` plugin and shadcn/ui for component primitives. Split the current Workouts page into separate Exercise Encyclopedia (`/exercises`) and Workout Sessions (`/workouts`) routes. Global dark theme via CSS custom properties in `src/index.css`. Category-specific accent colors for exercise cards.

**Tech Stack:** Tailwind CSS v4, shadcn/ui (Accordion, Card, Input, Badge, Button), Lucide React icons, Inter + JetBrains Mono fonts.

---

### Task 1: Install Tailwind CSS v4 + shadcn/ui dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.app.json`
- Create: `src/index.css`
- Create: `src/lib/utils.ts`
- Create: `components.json`

**Step 1: Install Tailwind CSS v4 and the Vite plugin**

Run:
```bash
npm install tailwindcss @tailwindcss/vite
```

**Step 2: Install shadcn/ui dependencies**

Run:
```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

**Step 3: Update `vite.config.ts` to add Tailwind plugin and path alias**

```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/apps/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Step 4: Update `tsconfig.json` to add path aliases**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Step 5: Update `tsconfig.app.json` to add path aliases**

Add to `compilerOptions`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

**Step 6: Create `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 7: Create `src/index.css` with Tailwind import and dark theme**

```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0a12;
  --color-bg-secondary: #13131d;
  --color-bg-elevated: #1a1a2a;
  --color-border-default: #2a2a3a;
  --color-border-hover: #3a3a5a;
  --color-text-primary: #e8e8f0;
  --color-text-secondary: #c0c0cc;
  --color-text-muted: #666;
  --color-text-dim: #444;

  --color-upper-pull: #5ec4e0;
  --color-upper-pull-bg: #1a2f3a;
  --color-upper-pull-border: #2d7d9a;
  --color-upper-pull-tag: #0e2530;

  --color-upper-push: #e05ec4;
  --color-upper-push-bg: #2f1a2a;
  --color-upper-push-border: #9a2d7d;
  --color-upper-push-tag: #30102a;

  --color-lower: #5ee06a;
  --color-lower-bg: #1a2f1e;
  --color-lower-border: #2d9a3d;
  --color-lower-tag: #0e3015;

  --color-core: #e0c45e;
  --color-core-bg: #2f2a1a;
  --color-core-border: #9a7d2d;
  --color-core-tag: #302a0e;

  --color-mobility: #5ed4e0;
  --color-mobility-bg: #1a2a2f;
  --color-mobility-border: #2d8a9a;
  --color-mobility-tag: #0e2a30;

  --color-grip: #c45ee0;
  --color-grip-bg: #2a1a2f;
  --color-grip-border: #7d2d9a;
  --color-grip-tag: #2a0e30;

  --color-cardio: #e08a5e;
  --color-cardio-bg: #2f1f1a;
  --color-cardio-border: #9a4d2d;
  --color-cardio-tag: #301a0e;

  --color-neck: #b0e05e;
  --color-neck-bg: #1f2f1a;
  --color-neck-border: #6d9a2d;
  --color-neck-tag: #1a300e;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}

@layer base {
  body {
    @apply bg-bg-primary text-text-primary font-sans antialiased;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--color-border-default);
    border-radius: 3px;
  }
}
```

**Step 8: Update `index.html` to load fonts and import CSS**

Add to `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Step 9: Update `src/main.tsx` to import the CSS**

Add at top:
```typescript
import "./index.css"
```

**Step 10: Run `npx shadcn@latest init` to set up components.json**

Run:
```bash
npx shadcn@latest init -d
```

If it prompts, choose: style=new-york, base-color=neutral, css-variables=yes.

If it doesn't auto-detect properly, create `components.json` manually:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

**Step 11: Install shadcn components**

Run:
```bash
npx shadcn@latest add accordion card input badge button
```

**Step 12: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind CSS v4 + shadcn/ui setup"
```

---

### Task 2: Create category color utilities

**Files:**
- Create: `src/lib/categories.ts`

**Step 1: Create the category config file**

```typescript
export const CATEGORIES = [
  "All",
  "Upper Pull",
  "Upper Push",
  "Lower",
  "Core",
  "Mobility & Posture",
  "Grip",
  "Cardio & Conditioning",
  "Neck",
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_STYLES: Record<
  Exclude<Category, "All">,
  { text: string; bg: string; border: string; tag: string }
> = {
  "Upper Pull": {
    text: "text-upper-pull",
    bg: "bg-upper-pull-bg",
    border: "border-upper-pull-border",
    tag: "bg-upper-pull-tag text-upper-pull",
  },
  "Upper Push": {
    text: "text-upper-push",
    bg: "bg-upper-push-bg",
    border: "border-upper-push-border",
    tag: "bg-upper-push-tag text-upper-push",
  },
  "Lower": {
    text: "text-lower",
    bg: "bg-lower-bg",
    border: "border-lower-border",
    tag: "bg-lower-tag text-lower",
  },
  "Core": {
    text: "text-core",
    bg: "bg-core-bg",
    border: "border-core-border",
    tag: "bg-core-tag text-core",
  },
  "Mobility & Posture": {
    text: "text-mobility",
    bg: "bg-mobility-bg",
    border: "border-mobility-border",
    tag: "bg-mobility-tag text-mobility",
  },
  "Grip": {
    text: "text-grip",
    bg: "bg-grip-bg",
    border: "border-grip-border",
    tag: "bg-grip-tag text-grip",
  },
  "Cardio & Conditioning": {
    text: "text-cardio",
    bg: "bg-cardio-bg",
    border: "border-cardio-border",
    tag: "bg-cardio-tag text-cardio",
  },
  "Neck": {
    text: "text-neck",
    bg: "bg-neck-bg",
    border: "border-neck-border",
    tag: "bg-neck-tag text-neck",
  },
}

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category as Exclude<Category, "All">] ?? {
    text: "text-text-muted",
    bg: "bg-bg-secondary",
    border: "border-border-default",
    tag: "bg-bg-elevated text-text-muted",
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/categories.ts
git commit -m "feat: add category color utilities"
```

---

### Task 3: Redesign Home page

**Files:**
- Modify: `src/pages/Home.tsx`

**Step 1: Rewrite Home.tsx with dark theme and nav cards**

```tsx
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Dumbbell, BookOpen, LogIn, LogOut } from "lucide-react"

export function Home() {
  const { user, signIn, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Auth bar */}
      <div className="flex justify-end p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-sm font-mono truncate max-w-48">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-secondary border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        )}
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">
          Apps
        </h1>
        <p className="text-text-muted text-sm mb-10">Personal tools</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
          <Link
            to="/exercises"
            className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-upper-pull-border transition-all duration-200 no-underline"
          >
            <BookOpen className="w-8 h-8 text-upper-pull mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Exercises
            </h2>
            <p className="text-text-muted text-sm">
              Form cues, progressions & notes
            </p>
          </Link>

          <Link
            to="/workouts"
            className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-cardio-border transition-all duration-200 no-underline"
          >
            <Dumbbell className="w-8 h-8 text-cardio mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Workouts
            </h2>
            <p className="text-text-muted text-sm">
              Session history & logging
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: redesign Home page with dark theme nav cards"
```

---

### Task 4: Create Exercise Encyclopedia page

**Files:**
- Create: `src/pages/Exercises.tsx`
- Modify: `src/App.tsx`

**Step 1: Create the full Exercises page**

Create `src/pages/Exercises.tsx`:

```tsx
import { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { CATEGORIES, getCategoryStyle } from "@/lib/categories"
import { ArrowLeft, Search, ChevronDown, Target, AlertTriangle, BarChart3, TrendingUp, StickyNote } from "lucide-react"
import { cn } from "@/lib/utils"

interface Exercise {
  id: string
  name: string
  category: string
  form_cues: string | null
  common_mistakes: string | null
  current_working: string | null
  progression: string | null
  personal_notes: string | null
  updated_at: string
}

const DETAIL_SECTIONS = [
  { key: "form_cues" as const, label: "Form Cues", icon: Target },
  { key: "common_mistakes" as const, label: "Common Mistakes", icon: AlertTriangle },
  { key: "current_working" as const, label: "Current Working", icon: BarChart3 },
  { key: "progression" as const, label: "Progression", icon: TrendingUp },
  { key: "personal_notes" as const, label: "Personal Notes", icon: StickyNote },
]

export function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name")

      if (error) {
        setError(error.message)
      } else {
        setExercises(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesCategory =
        activeCategory === "All" || ex.category === activeCategory
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.form_cues?.toLowerCase().includes(q) ||
        ex.personal_notes?.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [exercises, activeCategory, search])

  const categoryCounts = useMemo(() => {
    return exercises.reduce<Record<string, number>>((acc, ex) => {
      acc[ex.category] = (acc[ex.category] || 0) + 1
      return acc
    }, {})
  }, [exercises])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-upper-pull rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading exercises...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-upper-push-bg border border-upper-push-border rounded-xl p-6 max-w-sm text-center">
          <p className="text-upper-push font-semibold mb-2">
            Failed to load exercises
          </p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-upper-push-tag border border-upper-push-border rounded-lg text-upper-push text-sm font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-4">
          {/* Back + Title */}
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
                Exercise Encyclopedia
              </h1>
              <span className="text-text-dim text-xs font-mono font-medium">
                {exercises.length}
              </span>
            </div>
          </div>
          <p className="text-text-dim text-xs mb-3 ml-8">
            Form cues, progressions & notes
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none" />
            <input
              type="text"
              placeholder="Search exercises, cues, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2.5 pl-9 pr-4 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-sm font-sans placeholder:text-text-dim outline-none focus:border-border-hover transition-colors"
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat
              const count =
                cat === "All"
                  ? exercises.length
                  : categoryCounts[cat] || 0
              const style =
                cat !== "All" ? getCategoryStyle(cat) : null

              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                    isActive && style
                      ? `${style.border} ${style.bg} ${style.text}`
                      : isActive
                        ? "border-text-muted/40 bg-text-muted/10 text-text-secondary"
                        : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
                  )}
                >
                  {cat}
                  <span className="ml-1.5 opacity-60 font-mono text-[11px]">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">
              No exercises match "{search}" in{" "}
              {activeCategory === "All" ? "any category" : activeCategory}.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((ex) => {
              const style = getCategoryStyle(ex.category)
              const isExpanded = expandedId === ex.id
              const sections = DETAIL_SECTIONS.filter(
                (s) => ex[s.key]
              )

              return (
                <div
                  key={ex.id}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : ex.id)
                  }
                  className={cn(
                    "rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden",
                    isExpanded
                      ? `${style.bg} ${style.border}`
                      : "bg-bg-secondary border-border-default"
                  )}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md",
                          style.tag
                        )}
                      >
                        {ex.category}
                      </span>
                      <span className="text-text-primary text-[15px] font-semibold truncate">
                        {ex.name}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-text-dim shrink-0 ml-3 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      className="px-4 pb-4 sm:px-5 sm:pb-5 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <div
                        className={cn(
                          "h-px",
                          style.border
                        )}
                        style={{
                          background: `linear-gradient(90deg, transparent, var(--tw-border-opacity, currentColor), transparent)`,
                          opacity: 0.3,
                        }}
                      />

                      {sections.map((section) => {
                        const Icon = section.icon
                        return (
                          <div key={section.key}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon className={cn("w-3.5 h-3.5", style.text)} />
                              <span
                                className={cn(
                                  "text-xs font-bold font-mono uppercase tracking-wider",
                                  style.text
                                )}
                              >
                                {section.label}
                              </span>
                            </div>
                            <p className="text-text-secondary text-[13.5px] leading-relaxed m-0 pl-5">
                              {ex[section.key]}
                            </p>
                          </div>
                        )
                      })}

                      <div className="text-text-dim text-[11px] font-mono pt-1 border-t border-border-default">
                        Updated{" "}
                        {new Date(ex.updated_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Update `App.tsx` to add the exercises route**

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Exercises } from './pages/Exercises'
import { Workouts } from './pages/Workouts'

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <Exercises />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts"
            element={
              <ProtectedRoute>
                <Workouts />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/Exercises.tsx src/App.tsx
git commit -m "feat: add Exercise Encyclopedia page with search and category filters"
```

---

### Task 5: Redesign Workouts (sessions) page

**Files:**
- Modify: `src/pages/Workouts.tsx`

**Step 1: Rewrite Workouts.tsx focused on sessions with dark theme**

```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Calendar, Zap, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkoutSession {
  id: string
  date: string
  title: string | null
  session_type: string
  energy_level: number | null
  notes: string | null
}

function EnergyBar({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Zap className="w-3.5 h-3.5 text-core" />
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-3 rounded-sm transition-colors",
              i < level ? "bg-core" : "bg-border-default"
            )}
          />
        ))}
      </div>
      <span className="text-text-dim text-[11px] font-mono ml-0.5">
        {level}/10
      </span>
    </div>
  )
}

export function Workouts() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, date, title, session_type, energy_level, notes")
        .order("date", { ascending: false })
        .limit(20)

      if (error) {
        setError(error.message)
      } else {
        setSessions(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-cardio rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-upper-push-bg border border-upper-push-border rounded-xl p-6 max-w-sm text-center">
          <p className="text-upper-push font-semibold mb-2">
            Failed to load sessions
          </p>
          <p className="text-text-muted text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
                Workout Sessions
              </h1>
              <span className="text-text-dim text-xs font-mono font-medium">
                {sessions.length}
              </span>
            </div>
          </div>
          <p className="text-text-dim text-xs ml-8">
            Recent training history
          </p>
        </div>
      </div>

      {/* Sessions list */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">No sessions logged yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl bg-bg-secondary border border-border-default p-4 sm:p-5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-text-primary font-semibold text-[15px] m-0">
                      {s.title ?? s.session_type}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-text-dim" />
                      <span className="text-text-muted text-xs font-mono">
                        {new Date(s.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md bg-cardio-tag text-cardio">
                    {s.session_type}
                  </span>
                </div>

                {s.energy_level != null && (
                  <div className="mt-3">
                    <EnergyBar level={s.energy_level} />
                  </div>
                )}

                {s.notes && (
                  <div className="mt-3 flex gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-text-dim shrink-0 mt-0.5" />
                    <p className="text-text-secondary text-sm leading-relaxed m-0">
                      {s.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/pages/Workouts.tsx
git commit -m "feat: redesign Workouts page with session cards and energy indicators"
```

---

### Task 6: Style ProtectedRoute with dark theme

**Files:**
- Modify: `src/components/ProtectedRoute.tsx`

**Step 1: Update ProtectedRoute styling**

```tsx
import type { ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import { LogIn } from "lucide-react"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-upper-pull rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-bg-secondary border border-border-default rounded-xl p-8 max-w-sm text-center">
          <p className="text-text-secondary text-sm mb-4">
            Sign in to access this page.
          </p>
          <button
            onClick={signIn}
            className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

**Step 2: Update import paths in AuthContext.tsx**

Change: `import { supabase } from '../lib/supabase'` to `import { supabase } from '@/lib/supabase'`

(Do the same for any other files still using relative imports — consistency with the `@/` alias.)

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ProtectedRoute.tsx src/context/AuthContext.tsx
git commit -m "feat: style ProtectedRoute with dark theme and update import paths"
```

---

### Task 7: Final polish and visual verification

**Files:**
- Potentially modify: `src/index.css` (adjustments)

**Step 1: Run dev server and visually verify all pages**

Run: `npm run dev`

Check:
- Home page loads with dark background, two nav cards, auth button
- Exercise Encyclopedia loads with sticky header, search, category filters, expandable cards
- Workout Sessions loads with styled session cards
- Mobile viewport (375px wide) looks good — cards are full-width, filters scroll horizontally
- All loading states show spinner
- ProtectedRoute shows sign-in prompt when logged out

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS with no errors or warnings

**Step 3: Commit any polish adjustments**

```bash
git add -A
git commit -m "feat: final visual polish for redesigned pages"
```

---

### Task 8: Update CLAUDE.md architecture section

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the architecture section to reflect new structure**

Update the file listing:
```
src/
  main.tsx                     # React root
  index.css                    # Tailwind CSS + dark theme variables
  App.tsx                      # HashRouter + route definitions
  lib/supabase.ts              # Supabase client (anon key inline)
  lib/utils.ts                 # cn() utility for Tailwind class merging
  lib/categories.ts            # Exercise category colors and utilities
  context/AuthContext.tsx       # Google OAuth provider, useAuth() hook
  components/ProtectedRoute.tsx # Redirects to login if unauthenticated
  components/ui/               # shadcn/ui components (accordion, button, etc.)
  pages/Home.tsx               # Landing page with nav cards
  pages/Exercises.tsx          # Exercise encyclopedia with search/filters
  pages/Workouts.tsx           # Workout session history
```

Add to Key Patterns:
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin
- **shadcn/ui** — component primitives in `components/ui/`, installed via `npx shadcn@latest add`
- **Category colors** — defined as Tailwind theme colors in `index.css`, mapped in `lib/categories.ts`

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update architecture for visual redesign"
```
