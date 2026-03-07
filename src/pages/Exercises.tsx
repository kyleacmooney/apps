import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { CATEGORIES, getCategoryStyle } from "@/lib/categories"
import { formatSet, formatDuration, relativeDate, parseLocalDate, type TrendSet } from "@/lib/workout-utils"
import { ArrowLeft, ArrowRight, Search, ChevronDown, ChevronRight, Target, AlertTriangle, BarChart3, TrendingUp, StickyNote, Trophy, History, BookOpen, X, RefreshCw, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCanGoForward } from "@/lib/use-can-go-forward"

/** Render simple inline markdown (**bold**, *italic*) as React elements */
function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Match **bold** or *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index} className="text-text-primary font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

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

interface SessionHistoryEntry {
  id: string
  date: string
  title: string | null
  session_type: string
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


function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  summary,
  trendSessions,
  walkthroughExpandedId,
  onToggleWalkthrough,
  isHighlighted = false,
  sessionHistoryLoading = false,
  onToggleSessionHistory,
}: {
  exercise: Exercise
  isExpanded: boolean
  onToggle: () => void
  summary: ExerciseSummary | undefined
  trendSessions: ExerciseTrendSession[] | undefined
  walkthroughExpandedId: string | null
  onToggleWalkthrough: (id: string | null) => void
  isHighlighted?: boolean
  sessionHistoryLoading?: boolean
  onToggleSessionHistory: (exerciseId: string) => void
}) {
  const style = getCategoryStyle(exercise.category)
  const sections = DETAIL_SECTIONS.filter((s) => exercise[s.key])
  const hasBeenPerformed = summary && summary.total_sessions > 0

  return (
    <div
      onClick={() => onToggle()}
      className={cn(
        "rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden",
        isHighlighted
          ? `${style.bg} border-core/50 ring-1 ring-core/30`
          : isExpanded
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
              {exercise.category}
            </span>
            <span className={cn(
              "text-[15px] font-semibold truncate",
              hasBeenPerformed ? "text-text-primary" : "text-text-muted"
            )}>
              {exercise.name}
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
            {isExpanded ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSessionHistory(exercise.id)
                }}
                disabled={sessionHistoryLoading}
                className={cn(
                  "bg-transparent border-none p-0 cursor-pointer font-mono text-[11px] underline decoration-dotted underline-offset-2 transition-colors text-text-dim hover:text-text-secondary",
                  sessionHistoryLoading && "opacity-60 cursor-wait"
                )}
              >
                {sessionHistoryLoading ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 border border-text-dim border-t-text-muted rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <>{summary.total_sessions} {summary.total_sessions === 1 ? "session" : "sessions"}</>
                )}
              </button>
            ) : (
              <span>{summary.total_sessions} {summary.total_sessions === 1 ? "session" : "sessions"}</span>
            )}
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
                      <span className="text-text-secondary whitespace-nowrap shrink-0">
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
                  {renderMarkdown(exercise[section.key]!)}
                </p>
              </div>
            )
          })}

          {/* Detailed Walkthrough — collapsible */}
          {exercise.detailed_walkthrough && (() => {
            const isWtExpanded = walkthroughExpandedId === exercise.id
            return (
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleWalkthrough(isWtExpanded ? null : exercise.id)
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
                    {exercise.detailed_walkthrough!.split("\n").map((line, i) => (
                      line.trim() === "" ? (
                        <div key={i} className="h-2.5" />
                      ) : (
                        <p key={i} className="text-text-secondary text-[13.5px] leading-relaxed m-0">
                          {renderMarkdown(line)}
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
            {new Date(exercise.updated_at).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" }
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const LONG_PRESS_MS = 500

function CategoryFilterRow({
  categories,
  activeCategory,
  excludedCategories,
  exercises,
  categoryCounts,
  onSelect,
  onLongPress,
}: {
  categories: readonly string[]
  activeCategory: string
  excludedCategories: Set<string>
  exercises: Exercise[]
  categoryCounts: Record<string, number>
  onSelect: (cat: string) => void
  onLongPress: (cat: string) => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const didLongPress = useRef(false)

  function handlePointerDown(cat: string) {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(cat)
    }, LONG_PRESS_MS)
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current)
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
      {categories.map((cat) => {
        const isActive = activeCategory === cat
        const isExcluded = cat !== "All" && excludedCategories.has(cat)
        const count =
          cat === "All"
            ? exercises.length - exercises.filter((ex) => excludedCategories.has(ex.category)).length
            : categoryCounts[cat] || 0
        const style = cat !== "All" ? getCategoryStyle(cat) : null

        return (
          <button
            key={cat}
            onClick={() => {
              if (didLongPress.current) return
              onSelect(cat)
            }}
            onPointerDown={() => handlePointerDown(cat)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap select-none touch-manipulation",
              isExcluded
                ? "border-border-default bg-transparent text-text-dim line-through opacity-50"
                : isActive && style
                  ? `${style.border} ${style.bg} ${style.text}`
                  : isActive
                    ? "border-text-muted/40 bg-text-muted/10 text-text-secondary"
                    : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
            )}
          >
            {isExcluded && <X className="w-3 h-3 inline mr-0.5 -ml-0.5" />}
            {cat}
            <span className="ml-1.5 opacity-60 font-mono text-[11px]">
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Exercises() {
  const canGoForward = useCanGoForward()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const exerciseData = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const [exercisesRes, summaryRes, trendRes] = await Promise.all([
        supabase.from("exercises").select("*").order("name"),
        supabase.from("exercise_summary").select("*"),
        supabase.from("exercise_recent_trend").select("*"),
      ])

      if (exercisesRes.error) throw exercisesRes.error

      const summaryMap = new Map<string, ExerciseSummary>()
      for (const row of summaryRes.data ?? []) {
        summaryMap.set(row.exercise_id, row as ExerciseSummary)
      }

      const trendMap = new Map<string, ExerciseTrendSession[]>()
      for (const row of trendRes.data ?? []) {
        const entry = row as ExerciseTrendSession
        const existing = trendMap.get(entry.exercise_id) ?? []
        existing.push(entry)
        trendMap.set(entry.exercise_id, existing)
      }

      return { exercises: exercisesRes.data, summaryMap, trendMap }
    },
  })

  const exercises = exerciseData.data?.exercises ?? []
  const summaryMap = exerciseData.data?.summaryMap ?? new Map<string, ExerciseSummary>()
  const trendMap = exerciseData.data?.trendMap ?? new Map<string, ExerciseTrendSession[]>()
  const loading = exerciseData.isLoading
  const error = exerciseData.error?.message ?? null
  const refreshing = exerciseData.isRefetching

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [walkthroughExpandedId, setWalkthroughExpandedId] = useState<string | null>(null)
  const [linkedExerciseName, setLinkedExerciseName] = useState<string | null>(
    () => searchParams.get("exercise")
  )
  const [sessionHistoryOpenId, setSessionHistoryOpenId] = useState<string | null>(null)
  const [sessionHistoryCache, setSessionHistoryCache] = useState<Map<string, SessionHistoryEntry[]>>(new Map())
  const [sessionHistoryLoading, setSessionHistoryLoading] = useState(false)
  // Sheet animation: mount first, then animate in; animate out, then unmount
  const [sheetMountedId, setSheetMountedId] = useState<string | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const sheetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Sheet open: mount DOM, then trigger transition on next frame
  useEffect(() => {
    clearTimeout(sheetTimerRef.current)
    if (sessionHistoryOpenId) {
      setSheetMountedId(sessionHistoryOpenId)
      requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)))
    } else {
      setSheetVisible(false)
      sheetTimerRef.current = setTimeout(() => setSheetMountedId(null), 300)
    }
  }, [sessionHistoryOpenId])

  const closeSheet = useCallback(() => setSessionHistoryOpenId(null), [])

  // Disable background scrolling while the sheet is open
  useEffect(() => {
    if (sheetMountedId) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [sheetMountedId])

  // Derive filter/sort state from URL params
  const search = searchParams.get("q") || ""
  const activeCategory = searchParams.get("cat") || "All"
  const sortBy = (searchParams.get("sort") as SortOption) || "last_performed"
  const excludedCategories = useMemo(() => {
    const raw = searchParams.get("exclude") || ""
    return raw ? new Set(raw.split(",")) : new Set<string>()
  }, [searchParams])

  const PARAM_DEFAULTS: Record<string, string> = { q: "", cat: "All", sort: "last_performed", exclude: "" }

  const linkedExercise = useMemo(() => {
    if (!linkedExerciseName) return null
    return exercises.find(
      (ex) => ex.name.toLowerCase() === linkedExerciseName.toLowerCase()
    ) ?? null
  }, [linkedExerciseName, exercises])

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== PARAM_DEFAULTS[k]) next.set(k, v)
      else next.delete(k)
    }
    // Clear deep-link and session history when user interacts with search/filter/sort
    next.delete("exercise")
    setLinkedExerciseName(null)
    setSessionHistoryOpenId(null)
    setSearchParams(next, { replace: true })
  }

  async function toggleSessionHistory(exerciseId: string) {
    if (sessionHistoryOpenId === exerciseId) {
      setSessionHistoryOpenId(null)
      return
    }

    // If cached, open immediately
    if (sessionHistoryCache.has(exerciseId)) {
      setSessionHistoryOpenId(exerciseId)
      return
    }

    // Fetch first, then open sheet with data ready
    setSessionHistoryLoading(true)
    const { data: exerciseRows } = await supabase
      .from("workout_exercises")
      .select("session_id")
      .eq("exercise_id", exerciseId)

    const sessionIds = [...new Set(exerciseRows?.map((r) => r.session_id) ?? [])]
    let sessions: SessionHistoryEntry[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, date, title, session_type")
        .in("id", sessionIds)
        .order("date", { ascending: false })
      sessions = (data as SessionHistoryEntry[]) ?? []
    }

    setSessionHistoryCache((prev) => {
      const next = new Map(prev)
      next.set(exerciseId, sessions)
      return next
    })
    setSessionHistoryLoading(false)
    setSessionHistoryOpenId(exerciseId)
  }

  // Deep-link from Workouts: auto-expand the linked exercise once data loads
  useEffect(() => {
    if (!linkedExerciseName || exercises.length === 0) return
    const match = exercises.find(
      (ex) => ex.name.toLowerCase() === linkedExerciseName.toLowerCase()
    )
    if (match) setExpandedId(match.id)
  }, [exercises]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const base = exercises.filter((ex) => {
      // Exclude linked exercise from normal list to avoid duplication
      if (linkedExercise && ex.id === linkedExercise.id) return false
      const matchesCategory =
        activeCategory === "All"
          ? !excludedCategories.has(ex.category)
          : ex.category === activeCategory
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
  }, [exercises, activeCategory, search, sortBy, summaryMap, linkedExercise, excludedCategories])

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
              <button
                onClick={() => navigate("/")}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <Home className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(-1)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-baseline gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
                    Exercise Encyclopedia
                  </h1>
                  <span className="text-text-dim text-xs font-mono font-medium">
                    {exercises.length}
                  </span>
                </div>
                <p className="text-text-dim text-xs m-0">
                  Form cues, progressions & notes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSessionHistoryCache(new Map())
                  setSessionHistoryOpenId(null)
                  queryClient.invalidateQueries({ queryKey: ['exercises'] })
                }}
                className="p-1.5 rounded-lg text-text-dim hover:text-text-muted transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              </button>
              {canGoForward && (
                <button
                  onClick={() => navigate(1)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="h-3" />

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none" />
            <input
              type="text"
              placeholder="Search exercises, cues, notes..."
              value={search}
              onChange={(e) => updateParams({ q: e.target.value || null })}
              className="w-full py-2.5 pl-9 pr-9 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-base font-sans placeholder:text-text-dim outline-none focus:border-border-hover transition-colors"
            />
            {search && (
              <button
                onClick={() => updateParams({ q: null })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category filters — tap to select, long-press to exclude */}
          <CategoryFilterRow
            categories={CATEGORIES}
            activeCategory={activeCategory}
            excludedCategories={excludedCategories}
            exercises={exercises}
            categoryCounts={categoryCounts}
            onSelect={(cat) => {
              if (cat === "All") {
                updateParams({ cat: "All", exclude: null })
              } else if (excludedCategories.has(cat)) {
                // Tap an excluded category to un-exclude it
                const next = new Set(excludedCategories)
                next.delete(cat)
                const excludeStr = [...next].join(",") || null
                updateParams({ exclude: excludeStr })
              } else {
                updateParams({ cat, exclude: null })
              }
            }}
            onLongPress={(cat) => {
              if (cat === "All") return
              // Long-press only works from "All" view — exclusion subtracts from the full list
              if (activeCategory !== "All") return
              const next = new Set(excludedCategories)
              if (next.has(cat)) next.delete(cat)
              else next.add(cat)
              const excludeStr = [...next].join(",") || null
              updateParams({ exclude: excludeStr })
            }}
          />

          {/* Sort options */}
          <div className="flex items-center gap-2 mt-2.5 select-none">
            <span className="text-text-dim text-[11px] font-mono">Sort:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateParams({ sort: opt.value })}
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
        {/* Linked exercise section */}
        {linkedExercise && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-text-dim text-[11px] font-bold font-mono uppercase tracking-widest">
                Linked Exercise
              </span>
              <div className="flex-1 h-px bg-border-default" />
              <button
                onClick={() => {
                  setLinkedExerciseName(null)
                  const next = new URLSearchParams(searchParams)
                  next.delete("exercise")
                  setSearchParams(next, { replace: true })
                }}
                className="text-text-dim hover:text-text-muted transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ExerciseCard
              exercise={linkedExercise}
              isExpanded={expandedId === linkedExercise.id}
              onToggle={() => {
                setExpandedId(expandedId === linkedExercise.id ? null : linkedExercise.id)
                if (expandedId === linkedExercise.id) setWalkthroughExpandedId(null)
              }}
              summary={summaryMap.get(linkedExercise.id)}
              trendSessions={trendMap.get(linkedExercise.id)}
              walkthroughExpandedId={walkthroughExpandedId}
              onToggleWalkthrough={setWalkthroughExpandedId}
              isHighlighted
              sessionHistoryLoading={sessionHistoryLoading}
              onToggleSessionHistory={toggleSessionHistory}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">
              No exercises match{search ? ` "${search}" in` : ""}{" "}
              {activeCategory === "All"
                ? excludedCategories.size > 0
                  ? "the selected categories"
                  : "any category"
                : activeCategory}.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                isExpanded={expandedId === ex.id}
                onToggle={() => {
                  setExpandedId(expandedId === ex.id ? null : ex.id)
                  if (expandedId === ex.id) setWalkthroughExpandedId(null)
                }}
                summary={summaryMap.get(ex.id)}
                trendSessions={trendMap.get(ex.id)}
                walkthroughExpandedId={walkthroughExpandedId}
                onToggleWalkthrough={setWalkthroughExpandedId}
                sessionHistoryLoading={sessionHistoryLoading}
                onToggleSessionHistory={toggleSessionHistory}
              />
            ))}
          </div>
        )}
      </div>

      {/* Session history bottom sheet */}
      {sheetMountedId && (() => {
        const sheetExercise = exercises.find((ex) => ex.id === sheetMountedId)
        const sheetSessions = sessionHistoryCache.get(sheetMountedId) ?? []
        const sheetStyle = sheetExercise ? getCategoryStyle(sheetExercise.category) : null

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
              className={cn(
                "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                sheetVisible ? "opacity-100" : "opacity-0"
              )}
              onClick={closeSheet}
            />
            {/* Sheet */}
            <div
              className={cn(
                "relative w-full max-w-lg bg-bg-secondary rounded-t-2xl border-t border-x border-border-default min-h-[30vh] max-h-[70vh] flex flex-col transition-transform duration-300 ease-out",
                sheetVisible ? "translate-y-0" : "translate-y-full"
              )}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-text-dim/30" />
              </div>
              {/* Header */}
              <div className="px-5 pb-3 border-b border-border-default">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {sheetExercise && sheetStyle && (
                      <span className={cn("shrink-0 text-[10px] font-semibold font-mono uppercase tracking-wide px-2 py-0.5 rounded-md", sheetStyle.tag)}>
                        {sheetExercise.category}
                      </span>
                    )}
                    <h2 className="text-base font-semibold text-text-primary m-0 truncate">
                      {sheetExercise?.name ?? "Sessions"}
                    </h2>
                  </div>
                  <button
                    onClick={closeSheet}
                    className="p-1.5 rounded-lg text-text-dim hover:text-text-muted transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-text-dim text-[11px] font-mono mt-1">
                  {sheetSessions.length} workout {sheetSessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>
              {/* Session list */}
              <div className="overflow-y-auto flex-1 overscroll-contain">
                {sheetSessions.length > 0 ? (
                  <div className="flex flex-col pb-6">
                    {sheetSessions.map((s, i) => (
                      <Link
                        key={s.id}
                        to={`/workouts?session=${s.id}`}
                        onClick={closeSheet}
                        className={cn(
                          "flex items-center justify-between gap-3 px-5 py-3.5 transition-colors group no-underline",
                          "hover:bg-bg-elevated/50 active:bg-bg-elevated/70",
                          i < sheetSessions.length - 1 && "border-b border-border-default"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-text-dim text-[11px] font-mono whitespace-nowrap w-14 shrink-0">
                            {relativeDate(s.date)}
                          </span>
                          <div className="min-w-0">
                            <span className="text-text-primary text-[13px] font-medium block truncate">
                              {s.title ?? s.session_type}
                            </span>
                            <span className="text-text-dim text-[11px] font-mono">
                              {parseLocalDate(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-text-muted shrink-0 transition-colors" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-dim text-sm">
                    No sessions found
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
