import { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { CATEGORIES, getCategoryStyle } from "@/lib/categories"
import { formatSet, formatDuration, relativeDate, type TrendSet } from "@/lib/workout-utils"
import { ArrowLeft, Search, ChevronDown, Target, AlertTriangle, BarChart3, TrendingUp, StickyNote, Trophy, History, BookOpen, X, RefreshCw } from "lucide-react"
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
  detailed_walkthrough: string | null
  updated_at: string
}

interface ExerciseSummary {
  exercise_id: string
  name: string
  category: string
  current_working: string | null
  last_performed: string | null
  total_sessions: number
  latest_pr: {
    weight: number
    weight_unit: string
    reps: number
    date: string
    notes: string | null
  } | null
  best_duration_seconds: number | null
  max_weight: number | null
  best_weight_set: {
    weight: number
    weight_unit: string
    reps: number
  } | null
}

interface ExerciseTrendSession {
  exercise_id: string
  name: string
  date: string
  session_id: string
  sets: TrendSet[]
}

const DETAIL_SECTIONS = [
  { key: "form_cues" as const, label: "Form Cues", icon: Target },
  { key: "common_mistakes" as const, label: "Common Mistakes", icon: AlertTriangle },
  { key: "current_working" as const, label: "Current Working", icon: BarChart3 },
  { key: "progression" as const, label: "Progression", icon: TrendingUp },
  { key: "personal_notes" as const, label: "Personal Notes", icon: StickyNote },
]

type SortOption = "name" | "last_performed" | "total_sessions"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "last_performed", label: "Recent" },
  { value: "name", label: "A-Z" },
  { value: "total_sessions", label: "Most Used" },
]

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [summaryMap, setSummaryMap] = useState<Map<string, ExerciseSummary>>(new Map())
  const [trendMap, setTrendMap] = useState<Map<string, ExerciseTrendSession[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [sortBy, setSortBy] = useState<SortOption>("last_performed")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [walkthroughExpandedId, setWalkthroughExpandedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    async function load() {
      const [exercisesRes, summaryRes, trendRes] = await Promise.all([
        supabase.from("exercises").select("*").order("name"),
        supabase.from("exercise_summary").select("*"),
        supabase.from("exercise_recent_trend").select("*"),
      ])

      if (exercisesRes.error) {
        setError(exercisesRes.error.message)
      } else {
        setExercises(exercisesRes.data)
      }

      if (summaryRes.data) {
        const map = new Map<string, ExerciseSummary>()
        for (const row of summaryRes.data) {
          map.set(row.exercise_id, row as ExerciseSummary)
        }
        setSummaryMap(map)
      }

      if (trendRes.data) {
        const map = new Map<string, ExerciseTrendSession[]>()
        for (const row of trendRes.data) {
          const entry = row as ExerciseTrendSession
          const existing = map.get(entry.exercise_id) ?? []
          existing.push(entry)
          map.set(entry.exercise_id, existing)
        }
        setTrendMap(map)
      }

      setLoading(false)
      setRefreshing(false)
    }
    load()
  }, [refreshKey])

  const filtered = useMemo(() => {
    const base = exercises.filter((ex) => {
      const matchesCategory =
        activeCategory === "All" || ex.category === activeCategory
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.form_cues?.toLowerCase().includes(q) ||
        ex.personal_notes?.toLowerCase().includes(q) ||
        ex.detailed_walkthrough?.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })

    return [...base].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      }
      if (sortBy === "last_performed") {
        const aDate = summaryMap.get(a.id)?.last_performed ?? ""
        const bDate = summaryMap.get(b.id)?.last_performed ?? ""
        if (!aDate && !bDate) return a.name.localeCompare(b.name)
        if (!aDate) return 1
        if (!bDate) return -1
        return bDate.localeCompare(aDate)
      }
      // total_sessions
      const aCount = summaryMap.get(a.id)?.total_sessions ?? 0
      const bCount = summaryMap.get(b.id)?.total_sessions ?? 0
      if (aCount === bCount) return a.name.localeCompare(b.name)
      return bCount - aCount
    })
  }, [exercises, activeCategory, search, sortBy, summaryMap])

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
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
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
            <button
              onClick={() => {
                setRefreshing(true)
                setRefreshKey((k) => k + 1)
              }}
              className="p-1.5 rounded-lg text-text-dim hover:text-text-muted transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
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
              className="w-full py-2.5 pl-9 pr-9 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-base font-sans placeholder:text-text-dim outline-none focus:border-border-hover transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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

          {/* Sort options */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-text-dim text-[11px] font-mono">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold font-mono transition-all cursor-pointer",
                  sortBy === opt.value
                    ? "border border-text-muted/40 bg-text-muted/10 text-text-secondary"
                    : "border border-transparent text-text-dim hover:text-text-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
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
              const summary = summaryMap.get(ex.id)
              const hasBeenPerformed = summary && summary.total_sessions > 0
              const trendSessions = trendMap.get(ex.id)

              return (
                <div
                  key={ex.id}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : ex.id)
                    if (isExpanded) setWalkthroughExpandedId(null)
                  }}
                  className={cn(
                    "rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden",
                    isExpanded
                      ? `${style.bg} ${style.border}`
                      : "bg-bg-secondary border-border-default"
                  )}
                >
                  {/* Card header */}
                  <div className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md",
                            style.tag
                          )}
                        >
                          {ex.category}
                        </span>
                        <span className={cn(
                          "text-[15px] font-semibold truncate",
                          hasBeenPerformed ? "text-text-primary" : "text-text-muted"
                        )}>
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

                    {/* Stats row — only when exercise has been performed */}
                    {hasBeenPerformed && (
                      <div className="flex items-center gap-1.5 mt-1.5 ml-[calc(0.625rem+theme(spacing.2.5))] text-text-dim text-[11px] font-mono flex-wrap">
                        <span>{summary.total_sessions} {summary.total_sessions === 1 ? "session" : "sessions"}</span>
                        {summary.last_performed && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>Last {relativeDate(summary.last_performed)}</span>
                          </>
                        )}
                        {summary.latest_pr && summary.latest_pr.reps != null && summary.latest_pr.weight != null && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="flex items-center gap-1 text-core">
                              <Trophy className="w-3 h-3" />
                              PR: {summary.latest_pr.reps} × {summary.latest_pr.weight}{summary.latest_pr.weight_unit}
                            </span>
                          </>
                        )}
                        {summary.best_duration_seconds != null && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className={cn("flex items-center gap-1", summary.latest_pr && "text-core")}>
                              {summary.latest_pr && <Trophy className="w-3 h-3" />}
                              Best: {formatDuration(summary.best_duration_seconds)}
                            </span>
                          </>
                        )}
                        {!summary.latest_pr?.reps && summary.best_duration_seconds == null && summary.best_weight_set != null && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="flex items-center gap-1 text-core">
                              <Trophy className="w-3 h-3" />
                              PR: {summary.best_weight_set.reps} × {summary.best_weight_set.weight}{summary.best_weight_set.weight_unit}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 flex flex-col gap-3.5">
                      <div
                        className="h-px"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${style.borderColor}, transparent)`,
                        }}
                      />

                      {/* Latest Session */}
                      {trendSessions && trendSessions.length > 0 && (() => {
                        const latest = trendSessions[0]
                        const displayableSets = latest.sets.filter(
                          (s) => s.reps != null || s.duration_seconds != null
                        )
                        if (displayableSets.length === 0) return null
                        return (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <History className={cn("w-3.5 h-3.5", style.text)} />
                              <span
                                className={cn(
                                  "text-xs font-bold font-mono uppercase tracking-wider",
                                  style.text
                                )}
                              >
                                Latest Session
                              </span>
                              <span className="text-text-dim text-[11px] font-mono">
                                {parseLocalDate(latest.date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="pl-5 flex flex-col gap-0.5">
                              {displayableSets.map((set) => (
                                <div
                                  key={set.set_number}
                                  className="flex items-baseline gap-2 text-[12.5px] font-mono"
                                >
                                  <span className="text-text-dim w-4 text-right shrink-0">
                                    {set.set_number})
                                  </span>
                                  <span className="text-text-secondary">
                                    {formatSet(set)}
                                  </span>
                                  {set.is_pr && (
                                    <span className="text-core text-[10px] font-bold uppercase tracking-wider">
                                      PR
                                    </span>
                                  )}
                                  {set.notes && (
                                    <span className="text-text-dim text-[11px] font-sans italic">
                                      — {set.notes}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

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

                      {/* Detailed Walkthrough — collapsible */}
                      {ex.detailed_walkthrough && (() => {
                        const isWtExpanded = walkthroughExpandedId === ex.id
                        return (
                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setWalkthroughExpandedId(isWtExpanded ? null : ex.id)
                              }}
                              className="flex items-center gap-1.5 w-full text-left cursor-pointer bg-transparent border-none p-0"
                            >
                              <BookOpen className={cn("w-3.5 h-3.5 transition-colors", isWtExpanded ? style.text : "text-text-dim")} />
                              <span
                                className={cn(
                                  "text-xs font-bold font-mono uppercase tracking-wider transition-colors",
                                  isWtExpanded ? style.text : "text-text-dim"
                                )}
                              >
                                Detailed Walkthrough
                              </span>
                              <ChevronDown
                                className={cn(
                                  "w-3 h-3 text-text-dim transition-transform duration-200",
                                  isWtExpanded && "rotate-180"
                                )}
                              />
                            </button>
                            {isWtExpanded && (
                              <div className="pl-5 mt-1.5">
                                {ex.detailed_walkthrough!.split("\n").map((line, i) => (
                                  line.trim() === "" ? (
                                    <div key={i} className="h-2.5" />
                                  ) : (
                                    <p key={i} className="text-text-secondary text-[13.5px] leading-relaxed m-0">
                                      {line}
                                    </p>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}

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
