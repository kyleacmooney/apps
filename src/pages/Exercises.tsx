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
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 flex flex-col gap-3.5">
                      <div
                        className="h-px"
                        style={{
                          background: `linear-gradient(90deg, transparent, var(--color-${ex.category === "Upper Pull" ? "upper-pull" : ex.category === "Upper Push" ? "upper-push" : ex.category === "Mobility & Posture" ? "mobility" : ex.category === "Cardio & Conditioning" ? "cardio" : ex.category.toLowerCase()}-border), transparent)`,
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
