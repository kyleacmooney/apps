import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { formatSet, parseLocalDate, getWeekStartStr, getWeekLabel, type TrendSet } from "@/lib/workout-utils"
import { ArrowLeft, ArrowRight, Calendar, ChevronLeft, Zap, FileText, ChevronDown, ChevronRight, Trophy, MapPin, Clock, List, RefreshCw, ChevronsDownUp, ChevronsUpDown, Loader2, X, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCanGoForward } from "@/lib/use-can-go-forward"

interface WorkoutSet extends TrendSet {
  id: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  section: string
  position: number
  notes: string | null
  workout_sets: WorkoutSet[]
}

interface WorkoutSession {
  id: string
  date: string
  title: string | null
  session_type: string
  energy_level: string | null
  energy_rating: number | null
  body_state: string | null
  time_of_day: string | null
  location: string | null
  notes: string | null
  workout_exercises: WorkoutExercise[]
}

/** Format a snake_case enum value for display: "full_send" → "Full Send" */
function formatEnum(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const SESSION_SELECT = `
  id, date, title, session_type, energy_level, energy_rating, body_state, time_of_day, location, notes,
  workout_exercises (
    id, exercise_name, section, position, notes,
    workout_sets (
      id, set_number, reps, weight, weight_unit,
      duration_seconds, is_pr, notes
    )
  )
`

type ViewMode = "list" | "calendar"

const SESSION_DOT_COLORS: Record<string, string> = {
  workout: "bg-session-workout",
  mobility: "bg-session-mobility",
  mixed: "bg-session-mixed",
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const SESSION_TYPE_STYLES: Record<string, string> = {
  workout: "bg-session-workout-bg text-session-workout font-bold",
  mobility: "bg-session-mobility-bg text-session-mobility",
  mixed: "bg-session-mixed-bg text-session-mixed",
}

const SECTION_ORDER = ["warmup", "main", "accessory"] as const
const SECTION_LABELS: Record<string, string> = {
  warmup: "Warmup",
  main: "Main",
  accessory: "Accessory",
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
    </div>
  )
}

function ExerciseRow({
  exercise,
  isExpanded,
  onToggle,
}: {
  exercise: WorkoutExercise
  isExpanded: boolean
  onToggle: () => void
}) {
  const sets = exercise.workout_sets
  const hasPR = sets.some((s) => s.is_pr)
  const setCount = sets.length
  const isExpandable = setCount > 0

  return (
    <div>
      <div
        onClick={isExpandable ? (e) => { e.stopPropagation(); onToggle() } : undefined}
        className={cn(
          "w-full flex items-center justify-between py-2 px-0 text-left",
          isExpandable && "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/exercises?exercise=${encodeURIComponent(exercise.exercise_name)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-text-primary text-[13.5px] font-medium truncate transition-colors hover:text-core active:text-core active:bg-core/10 rounded px-1 -mx-1 py-0.5"
          >
            {exercise.exercise_name}
          </Link>
          {hasPR && <Trophy className="w-3 h-3 text-core shrink-0" />}
        </div>
        {isExpandable && (
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-text-dim text-[11px] font-mono">
              {setCount} {setCount === 1 ? "set" : "sets"}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-text-dim transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="pb-2 pl-1">
          {exercise.notes && (
            <p className="text-text-muted text-xs italic mb-2 m-0">
              {exercise.notes}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {sets.map((set) => (
              <div
                key={set.id}
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
      )}
    </div>
  )
}

function SessionCard({
  session,
  isSessionExpanded,
  onToggleSession,
  isHighlighted: isDeepLinked = false,
}: {
  session: WorkoutSession
  isSessionExpanded: boolean
  onToggleSession: () => void
  isHighlighted?: boolean
}) {
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(new Set())
  const [highlighted, setHighlighted] = useState(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exercises = session.workout_exercises
  const isNonWorkout = session.session_type !== "workout"

  const triggerHighlight = useCallback(() => {
    if (!isNonWorkout) return
    setHighlighted(true)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlighted(false), 3000)
  }, [isNonWorkout])

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }
  }, [])

  // Group exercises by section
  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      label: SECTION_LABELS[key] ?? key,
      exercises: exercises
        .filter((e) => e.section === key)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((s) => s.exercises.length > 0)

  const exerciseCount = exercises.length
  const prCount = exercises.reduce(
    (acc, ex) => acc + ex.workout_sets.filter((s) => s.is_pr).length,
    0
  )

  return (
    <div
      onClick={(e) => {
        // Any tap on the card (including non-clickable areas) triggers highlight
        if (isNonWorkout) triggerHighlight()
        // If tap is on the card background itself (not child interactive), toggle session
        if (e.target === e.currentTarget) onToggleSession()
      }}
      className={cn(
        "rounded-xl bg-bg-secondary border transition-all duration-300",
        isDeepLinked
          ? "border-core/50 ring-1 ring-core/30"
          : "border-border-default",
        isNonWorkout && !isSessionExpanded
          ? cn("py-2 px-4 sm:px-5", !highlighted && "opacity-60")
          : "p-4 sm:p-5"
      )}
    >
      {/* Session header — clickable to expand/collapse */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          if (isNonWorkout && isSessionExpanded) triggerHighlight()
          onToggleSession()
        }}
        className="cursor-pointer select-none"
      >
        <div className={cn("flex items-start justify-between", isNonWorkout && !isSessionExpanded ? "mb-0" : "mb-2")}>
          <div className="flex items-start gap-2">
            <ChevronRight
              className={cn(
                "w-4 h-4 text-text-dim shrink-0 mt-0.5 transition-transform duration-200",
                isSessionExpanded && "rotate-90"
              )}
            />
            <div>
              <h3 className="text-text-primary font-semibold text-[15px] m-0">
                {session.title ?? session.session_type}
              </h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-text-dim" />
                  <span className="text-text-muted text-xs font-mono">
                    {parseLocalDate(session.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {session.time_of_day && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-text-dim" />
                    <span className="text-text-muted text-xs font-mono">
                      {session.time_of_day}
                    </span>
                  </div>
                )}
                {session.location && (
                  <div className={cn("flex items-center gap-1", isNonWorkout && !isSessionExpanded && "hidden")}>
                    <MapPin className="w-3 h-3 text-text-dim" />
                    <span className="text-text-muted text-xs font-mono">
                      {session.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className={cn(
            "shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md",
            SESSION_TYPE_STYLES[session.session_type] ?? "bg-bg-elevated text-text-muted"
          )}>
            {session.session_type}
          </span>
        </div>

        {/* Hide energy/body metadata on collapsed non-workout cards */}
        {(isSessionExpanded || !isNonWorkout) && (session.energy_rating != null || session.energy_level || session.body_state) && (
          <div className="flex items-center gap-2 ml-6 flex-wrap">
            {session.energy_rating != null ? (
              <EnergyBar level={session.energy_rating} />
            ) : session.energy_level ? (
              <Zap className="w-3.5 h-3.5 text-core" />
            ) : null}
            {session.energy_level && (
              <span className="text-text-muted text-xs font-mono">
                {formatEnum(session.energy_level)}
              </span>
            )}
            {session.body_state && (
              <>
                {(session.energy_rating != null || session.energy_level) && (
                  <span className="text-text-dim text-xs">·</span>
                )}
                <span className="text-text-muted text-xs font-mono">
                  {formatEnum(session.body_state)}
                </span>
              </>
            )}
          </div>
        )}

        {/* Summary line when collapsed — only for workout cards */}
        {!isSessionExpanded && !isNonWorkout && exerciseCount > 0 && (
          <div className="flex items-center gap-2 mt-2 ml-6">
            <span className="text-text-dim text-xs font-mono">
              {exerciseCount} exercises
            </span>
            {prCount > 0 && (
              <>
                <span className="text-text-dim text-xs">·</span>
                <span className="text-core text-xs font-mono flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {prCount} {prCount === 1 ? "PR" : "PRs"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isSessionExpanded && (
        <>
          {/* Exercise sections */}
          {sections.length > 0 && (
            <div className="mt-4 ml-6 flex flex-col gap-3">
              {/* Expand/Collapse all toggle */}
              {(() => {
                const expandableIds = exercises.filter((e) => e.workout_sets.length > 0).map((e) => e.id)
                const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expandedExerciseIds.has(id))
                return expandableIds.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedExerciseIds(allExpanded ? new Set() : new Set(expandableIds))
                    }}
                    className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-[11px] font-mono transition-colors self-end"
                  >
                    {allExpanded ? (
                      <><ChevronsDownUp className="w-3 h-3" /> Collapse all</>
                    ) : (
                      <><ChevronsUpDown className="w-3 h-3" /> Expand all</>
                    )}
                  </button>
                )
              })()}
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-dim text-[10px] font-bold font-mono uppercase tracking-widest">
                      {section.label}
                    </span>
                    <div className="flex-1 h-px bg-border-default" />
                  </div>
                  <div className="flex flex-col">
                    {section.exercises.map((ex) => (
                      <ExerciseRow
                        key={ex.id}
                        exercise={ex}
                        isExpanded={expandedExerciseIds.has(ex.id)}
                        onToggle={() =>
                          setExpandedExerciseIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(ex.id)) next.delete(ex.id)
                            else next.add(ex.id)
                            return next
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Session notes — always shown when present */}
          {session.notes && (
            <div className="mt-3 ml-6 flex gap-1.5">
              <FileText className="w-3.5 h-3.5 text-text-dim shrink-0 mt-0.5" />
              <p className="text-text-secondary text-sm leading-relaxed m-0">
                {session.notes}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

async function fetchMonth(y: number, m: number): Promise<WorkoutSession[]> {
  const firstDay = formatDateStr(y, m, 1)
  const lastDayNum = new Date(y, m + 1, 0).getDate()
  const lastDay = formatDateStr(y, m, lastDayNum)

  const { data } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date", { ascending: false })

  return data ?? []
}

function CalendarView({
  initialDate,
  onDateSelect,
}: {
  initialDate: string | null
  onDateSelect: (date: string | null) => void
}) {
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate) {
      const [y, m] = initialDate.split("-").map(Number)
      return new Date(y, m - 1, 1)
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate)
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set())

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const monthQuery = useQuery({
    queryKey: ['workouts', 'calendar', year, month],
    queryFn: () => fetchMonth(year, month),
  })

  const sessions = monthQuery.data ?? []
  const loading = monthQuery.isLoading

  // Reset UI state on month change
  const prevMonth = useRef({ year, month })
  useEffect(() => {
    if (prevMonth.current.year !== year || prevMonth.current.month !== month) {
      setSelectedDate(null)
      setExpandedSessionIds(new Set())
      prevMonth.current = { year, month }
    }
  }, [year, month])

  // Prefetch adjacent months
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const adj = new Date(year, month + offset, 1)
      queryClient.prefetchQuery({
        queryKey: ['workouts', 'calendar', adj.getFullYear(), adj.getMonth()],
        queryFn: () => fetchMonth(adj.getFullYear(), adj.getMonth()),
      })
    }
  }, [year, month, queryClient])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>()
    for (const s of sessions) {
      const existing = map.get(s.date) ?? []
      existing.push(s)
      map.set(s.date, existing)
    }
    return map
  }, [sessions])

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : []

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-text-primary font-semibold text-base m-0 font-mono">
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-text-dim text-[10px] font-mono font-bold uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={cn("grid grid-cols-7 gap-1", loading && "opacity-50 pointer-events-none")}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />

          const dateStr = formatDateStr(year, month, day)
          const daySessions = sessionsByDate.get(dateStr) ?? []
          const isSelected = selectedDate === dateStr
          const isToday = dateStr === todayStr

          return (
            <button
              key={i}
              onClick={() => {
                const newDate = isSelected ? null : dateStr
                setSelectedDate(newDate)
                onDateSelect(newDate)
              }}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-sm transition-all",
                isSelected
                  ? "bg-bg-elevated border border-border-hover"
                  : "border border-transparent hover:bg-bg-elevated/50",
                isToday && "ring-1 ring-core/50",
                daySessions.length > 0 ? "text-text-primary font-medium" : "text-text-dim"
              )}
            >
              <span className="text-[13px]">{day}</span>
              {daySessions.length > 0 && (
                <div className="flex gap-0.5">
                  {daySessions.map((s, j) => (
                    <div
                      key={j}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        SESSION_DOT_COLORS[s.session_type] ?? "bg-text-muted"
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day sessions */}
      {selectedDate && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-text-secondary text-sm font-medium">
              {parseLocalDate(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            {selectedSessions.length === 0 && selectedDate <= new Date().toISOString().split("T")[0] && (
              <span className="text-text-dim text-xs font-mono">— rest day</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {selectedSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isSessionExpanded={expandedSessionIds.has(s.id)}
                onToggleSession={() =>
                  setExpandedSessionIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(s.id)) next.delete(s.id)
                    else next.add(s.id)
                    return next
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 30
const SESSION_TYPES = ["all", "workout", "mobility", "mixed"] as const

export function Workouts() {
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set())
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const queryClient = useQueryClient()
  const viewMode: ViewMode = searchParams.get("view") === "calendar" ? "calendar" : "list"

  // Session type filter
  const [activeFilter, setActiveFilter] = useState<string>("all")

  // Deep-link
  const [linkedSession, setLinkedSession] = useState<WorkoutSession | null>(null)
  const [linkedSessionLoading, setLinkedSessionLoading] = useState(false)

  const sessionsQuery = useInfiniteQuery({
    queryKey: ['workouts', 'list'],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(SESSION_SELECT)
        .order("date", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)

      if (error) throw error
      return data ?? []
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return allPages.reduce((sum, page) => sum + page.length, 0)
    },
  })

  const sessions = useMemo(() => sessionsQuery.data?.pages.flat() ?? [], [sessionsQuery.data])
  const loading = sessionsQuery.isLoading
  const error = sessionsQuery.error?.message ?? null
  const refreshing = sessionsQuery.isRefetching
  const hasMore = sessionsQuery.hasNextPage ?? false
  const loadingMore = sessionsQuery.isFetchingNextPage

  // Auto-expand first workout on mount (not on refresh)
  const hasAutoExpanded = useRef(false)
  useEffect(() => {
    if (!hasAutoExpanded.current && sessions.length > 0 && !searchParams.get("session")) {
      const firstWorkout = sessions.find((s) => s.session_type === "workout")
      if (firstWorkout) setExpandedSessionIds(new Set([firstWorkout.id]))
      hasAutoExpanded.current = true
    }
  }, [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link: read ?session= param on mount
  useEffect(() => {
    const sessionId = searchParams.get("session")
    if (!sessionId) return

    setLinkedSessionLoading(true)

    supabase
      .from("workout_sessions")
      .select(SESSION_SELECT)
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (data) {
          setLinkedSession(data as WorkoutSession)
          setExpandedSessionIds((prev) => new Set([...prev, data.id]))
        }
        setLinkedSessionLoading(false)
      })

  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute dynamic type list (includes any unexpected types from data)
  const allTypes = useMemo(() => {
    const seen = new Set(sessions.map((s) => s.session_type))
    const extras = [...seen].filter(
      (t) => !(SESSION_TYPES as readonly string[]).includes(t)
    )
    return [...SESSION_TYPES, ...extras]
  }, [sessions])

  // Type counts for filter pills
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sessions.length }
    for (const s of sessions) {
      counts[s.session_type] = (counts[s.session_type] ?? 0) + 1
    }
    return counts
  }, [sessions])

  // Week-grouped sessions (with filter applied)
  const weekGroups = useMemo(() => {
    let filtered = activeFilter === "all"
      ? sessions
      : sessions.filter((s) => s.session_type === activeFilter)

    // Exclude linked session from timeline to avoid duplication
    if (linkedSession) {
      filtered = filtered.filter((s) => s.id !== linkedSession.id)
    }

    const groups = new Map<string, WorkoutSession[]>()
    for (const session of filtered) {
      const weekKey = getWeekStartStr(session.date)
      if (!groups.has(weekKey)) groups.set(weekKey, [])
      groups.get(weekKey)!.push(session)
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // desc by week start
      .map(([weekStart, weekSessions]) => ({
        key: weekStart,
        label: getWeekLabel(weekStart),
        sessions: weekSessions, // already sorted desc from query
      }))
  }, [sessions, activeFilter, linkedSession])

  const filteredCount = useMemo(() => {
    if (activeFilter === "all") return sessions.length
    return sessions.filter((s) => s.session_type === activeFilter).length
  }, [sessions, activeFilter])

  const toggleSession = useCallback((id: string) => {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      {/* Header — sticky in list view */}
      <div className={cn(
        "border-b border-border-default bg-bg-primary/95 backdrop-blur-sm z-10",
        viewMode === "list" && "sticky top-0"
      )}>
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-4">
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
                    Workout Sessions
                  </h1>
                  {viewMode === "list" && (
                    <span className="text-text-dim text-xs font-mono font-medium">
                      {activeFilter === "all"
                        ? sessions.length
                        : `${filteredCount} / ${sessions.length}`}
                    </span>
                  )}
                </div>
                <p className="text-text-dim text-xs m-0">
                  {viewMode === "list" ? "Recent training history" : "Monthly overview"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['workouts'] })
                }}
                className="p-1.5 rounded-lg text-text-dim hover:text-text-muted transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              </button>
            <div className="flex rounded-lg border border-border-default overflow-hidden">
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-dim hover:text-text-muted"
                )}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSearchParams({ view: "calendar" }, { replace: true })}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "calendar"
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-dim hover:text-text-muted"
                )}
              >
                <Calendar className="w-4 h-4" />
              </button>
              </div>
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

          {/* Session type filter pills — list view only */}
          {viewMode === "list" && (
            <div className="flex gap-1.5 overflow-x-auto mt-3 -mx-5 px-5 scrollbar-none">
              {allTypes.map((type) => {
                const isActive = activeFilter === type
                const count = typeCounts[type] ?? 0
                const style = type !== "all" ? SESSION_TYPE_STYLES[type] : null

                return (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap capitalize",
                      isActive && style
                        ? `${style} border-transparent`
                        : isActive
                          ? "border-text-muted/40 bg-text-muted/20 text-text-secondary"
                          : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
                    )}
                  >
                    {formatEnum(type)}
                    <span className="ml-1.5 opacity-60 font-mono text-[11px]">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {viewMode === "list" ? (
          <>
            {/* Deep-linked session */}
            {linkedSessionLoading && (
              <div className="mb-4 p-4 rounded-xl border border-border-default bg-bg-secondary animate-pulse">
                <div className="h-4 bg-bg-elevated rounded w-1/3 mb-2" />
                <div className="h-3 bg-bg-elevated rounded w-1/2" />
              </div>
            )}

            {linkedSession && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-text-dim text-[11px] font-bold font-mono uppercase tracking-widest">
                    Linked Session
                  </span>
                  <div className="flex-1 h-px bg-border-default" />
                  <button
                    onClick={() => {
                      setExpandedSessionIds((prev) => {
                        const next = new Set(prev)
                        next.delete(linkedSession.id)
                        return next
                      })
                      setLinkedSession(null)
                      const next = new URLSearchParams(searchParams)
                      next.delete("session")
                      setSearchParams(next, { replace: true })
                    }}
                    className="text-text-dim hover:text-text-muted transition-colors p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <SessionCard
                  session={linkedSession}
                  isSessionExpanded={expandedSessionIds.has(linkedSession.id)}
                  onToggleSession={() => toggleSession(linkedSession.id)}
                  isHighlighted
                />
              </div>
            )}

            {/* Week-grouped timeline */}
            {weekGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-dim text-sm">
                  {sessions.length === 0
                    ? "No sessions logged yet."
                    : "No sessions match this filter."}
                </p>
                {activeFilter !== "all" && sessions.length > 0 && (
                  <button
                    onClick={() => setActiveFilter("all")}
                    className="text-core text-sm mt-2 hover:underline"
                  >
                    Show all sessions
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {weekGroups.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-text-dim text-[11px] font-bold font-mono uppercase tracking-widest whitespace-nowrap">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-border-default" />
                      <span className="text-text-dim text-[11px] font-mono">
                        {group.sessions.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {group.sessions.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          isSessionExpanded={expandedSessionIds.has(s.id)}
                          onToggleSession={() => toggleSession(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => sessionsQuery.fetchNextPage()}
                disabled={loadingMore}
                className="w-full mt-6 py-3 rounded-xl border border-border-default bg-bg-secondary text-text-muted text-sm font-semibold hover:bg-bg-elevated hover:text-text-secondary transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  "Load earlier sessions"
                )}
              </button>
            )}
          </>
        ) : (
          <CalendarView
            initialDate={searchParams.get("date")}
            onDateSelect={(date) => {
              const params: Record<string, string> = { view: "calendar" }
              if (date) params.date = date
              setSearchParams(params, { replace: true })
            }}
          />
        )}
      </div>
    </div>
  )
}
