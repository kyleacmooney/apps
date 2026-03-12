import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { usePersistedState } from "@/lib/use-persisted-state"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { useDataClient } from "@/context/SupabaseContext"
import { formatSet, parseLocalDate, getWeekStartStr, getWeekLabel, type TrendSet } from "@/lib/workout-utils"
import { ArrowRight, Calendar, ChevronLeft, Zap, FileText, ChevronDown, ChevronRight, Trophy, MapPin, Clock, List, RefreshCw, ChevronsDownUp, ChevronsUpDown, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCanGoForward } from "@/lib/use-can-go-forward"
import { PageHeader } from "@/components/mobile/PageHeader"

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
  status: string
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
  id, date, title, session_type, status, energy_level, energy_rating, body_state, time_of_day, location, notes,
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

const SECTION_ORDER = ["warmup", "main", "accessory", "cooldown"] as const
const SECTION_LABELS: Record<string, string> = {
  warmup: "Warmup",
  main: "Main",
  accessory: "Accessory",
  cooldown: "Cooldown",
}


const LONG_PRESS_MS = 500

function SessionTypeFilterButton({
  type,
  isActive,
  isExcluded,
  count,
  canLongPress,
  onSelect,
  onLongPress,
}: {
  type: string
  isActive: boolean
  isExcluded: boolean
  count: number
  canLongPress: boolean
  onSelect: () => void
  onLongPress: () => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const didLongPress = useRef(false)
  const [pressing, setPressing] = useState(false)
  const [justToggled, setJustToggled] = useState(false)
  const style = type !== "all" ? SESSION_TYPE_STYLES[type] : null

  function handlePointerDown() {
    didLongPress.current = false
    if (canLongPress && type !== "all" && !isExcluded) {
      setPressing(true)
    }
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setPressing(false)
      setJustToggled(true)
      setTimeout(() => setJustToggled(false), 400)
      onLongPress()
    }, LONG_PRESS_MS)
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current)
    setPressing(false)
  }

  return (
    <button
      onClick={() => {
        if (didLongPress.current) return
        onSelect()
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap capitalize select-none touch-manipulation overflow-hidden",
        "transition-all duration-200",
        justToggled && "animate-[filter-pop_0.4s_ease-out]",
        isExcluded
          ? "border-upper-push-border/40 bg-upper-push-bg/30 text-text-dim line-through"
          : isActive && style
            ? `${style} border-transparent`
            : isActive
              ? "border-text-muted/40 bg-text-muted/20 text-text-secondary"
              : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
      )}
    >
      {/* Long-press progress fill */}
      {pressing && (
        <span
          className="absolute inset-0 rounded-lg opacity-20 animate-[filter-fill_0.5s_linear_forwards] origin-left"
          style={{
            background: isExcluded
              ? "var(--color-lower)"
              : "var(--color-upper-push)",
          }}
        />
      )}
      <span className="relative flex items-center gap-0.5">
        {isExcluded && <X className="w-3 h-3 inline -ml-0.5" />}
        {formatEnum(type)}
        <span className="ml-1 opacity-60 font-mono text-[11px]">{count}</span>
      </span>
    </button>
  )
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
  const [expandedExerciseIds, setExpandedExerciseIds] = usePersistedState<Set<string>>(
    `workouts:exerciseIds:${session.id}`,
    isDeepLinked ? new Set(session.workout_exercises.map((e) => e.id)) : new Set()
  )
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

async function fetchMonth(client: import('@supabase/supabase-js').SupabaseClient, y: number, m: number): Promise<WorkoutSession[]> {
  const firstDay = formatDateStr(y, m, 1)
  const lastDayNum = new Date(y, m + 1, 0).getDate()
  const lastDay = formatDateStr(y, m, lastDayNum)

  const { data } = await client
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("status", "completed")
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
  const supabase = useDataClient()
  const queryClient = useQueryClient()
  const [currentMonthStr, setCurrentMonthStr] = usePersistedState<string>(
    'workouts:calendarMonth',
    () => {
      if (initialDate) {
        const [y, m] = initialDate.split("-").map(Number)
        return `${y}-${m}`
      }
      const now = new Date()
      return `${now.getFullYear()}-${now.getMonth()}`
    }
  )
  const currentMonth = useMemo(() => {
    const [y, m] = currentMonthStr.split("-").map(Number)
    return new Date(y, m, 1)
  }, [currentMonthStr])
  const setCurrentMonth = useCallback((d: Date) => {
    setCurrentMonthStr(`${d.getFullYear()}-${d.getMonth()}`)
  }, [setCurrentMonthStr])
  const [selectedDate, setSelectedDate] = usePersistedState<string | null>('workouts:calendarDate', initialDate)
  const [expandedSessionIds, setExpandedSessionIds] = usePersistedState<Set<string>>('workouts:calendarExpandedIds', new Set())

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const monthQuery = useQuery({
    queryKey: ['workouts', 'calendar', year, month],
    queryFn: () => fetchMonth(supabase, year, month),
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
        queryFn: () => fetchMonth(supabase, adj.getFullYear(), adj.getMonth()),
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

function PlannedWorkoutCard({
  session,
  onDismiss,
}: {
  session: WorkoutSession
  onDismiss: () => void
}) {
  const supabase = useDataClient()
  const allExerciseIds = useMemo(
    () => new Set(session.workout_exercises.map((e) => e.id)),
    [session.workout_exercises]
  )
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(allExerciseIds)
  const [dismissing, setDismissing] = useState(false)

  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      label: SECTION_LABELS[key] ?? key,
      exercises: session.workout_exercises
        .filter((e) => e.section === key)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((s) => s.exercises.length > 0)

  const handleDismiss = async () => {
    setDismissing(true)
    // CASCADE FKs handle child rows automatically
    await supabase
      .from("workout_sessions")
      .delete()
      .eq("id", session.id)
    onDismiss()
  }

  return (
    <div className="rounded-xl bg-bg-secondary border-2 border-dashed border-core/30 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-text-primary font-semibold text-[15px] m-0">
            {session.title ?? "Planned Workout"}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-text-muted text-xs font-mono">
                {parseLocalDate(session.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            {session.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-text-dim" />
                <span className="text-text-muted text-xs font-mono">
                  {session.location}
                </span>
              </div>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md bg-core/15 text-core border border-core/30">
          Planned
        </span>
      </div>

      {/* Session notes */}
      {session.notes && (
        <div className="flex gap-1.5 mb-3">
          <FileText className="w-3.5 h-3.5 text-text-dim shrink-0 mt-0.5" />
          <p className="text-text-secondary text-sm leading-relaxed m-0">
            {session.notes}
          </p>
        </div>
      )}

      {/* Exercise sections */}
      {sections.map((section) => (
        <div key={section.key} className="mt-3">
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

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="mt-4 w-full py-2.5 rounded-lg border border-border-default bg-bg-elevated text-text-muted text-sm font-semibold hover:bg-bg-primary hover:text-text-secondary transition-all disabled:opacity-50"
      >
        {dismissing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Dismissing...
          </span>
        ) : (
          "Dismiss Plan"
        )}
      </button>
    </div>
  )
}

const PAGE_SIZE = 30
const SESSION_TYPES = ["all", "workout", "mobility", "mixed"] as const

export function Workouts() {
  const supabase = useDataClient()
  const [expandedSessionIds, setExpandedSessionIds] = usePersistedState<Set<string>>('workouts:expandedIds', new Set())
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const queryClient = useQueryClient()
  const viewMode: ViewMode = searchParams.get("view") === "calendar" ? "calendar" : "list"

  // Session type filter
  const [activeFilter, setActiveFilter] = usePersistedState<string>('workouts:activeFilter', "all")
  const [excludedTypes, setExcludedTypes] = usePersistedState<Set<string>>('workouts:excludedTypes', new Set())

  // Deep-link
  const [linkedSession, setLinkedSession] = useState<WorkoutSession | null>(null)


  // Planned sessions
  const plannedQuery = useQuery({
    queryKey: ['workouts', 'planned'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(SESSION_SELECT)
        .eq("status", "planned")
        .order("date", { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkoutSession[]
    },
  })
  const plannedSessions = plannedQuery.data ?? []

  const sessionsQuery = useInfiniteQuery({
    queryKey: ['workouts', 'list'],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(SESSION_SELECT)
        .eq("status", "completed")
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
      ? sessions.filter((s) => !excludedTypes.has(s.session_type))
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
  }, [sessions, activeFilter, excludedTypes, linkedSession])

  const filteredCount = useMemo(() => {
    if (activeFilter === "all") {
      return excludedTypes.size > 0
        ? sessions.filter((s) => !excludedTypes.has(s.session_type)).length
        : sessions.length
    }
    return sessions.filter((s) => s.session_type === activeFilter).length
  }, [sessions, activeFilter, excludedTypes])

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

  if (sessions.length === 0 && plannedSessions.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-5">
        <Calendar className="w-12 h-12 text-text-dim mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          No workouts yet
        </h2>
        <p className="text-text-muted text-sm text-center max-w-xs mb-6">
          Log your first workout through a conversation with Claude. Your session history will appear here automatically.
        </p>
        <Link
          to="/"
          className="px-5 py-2 rounded-lg bg-bg-secondary border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors no-underline"
        >
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        title={
          <>
            <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
              Workout Sessions
            </h1>
            {viewMode === "list" && (
              <span className="text-text-dim text-xs font-mono font-medium">
                {activeFilter === "all" && excludedTypes.size === 0
                  ? sessions.length
                  : `${filteredCount} / ${sessions.length}`}
              </span>
            )}
          </>
        }
        subtitle={viewMode === "list" ? "Recent training history" : "Monthly overview"}
        sticky={viewMode === "list"}
        rightActions={
          <>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['workouts'] })
              }}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-text-dim hover:text-text-muted hover:bg-bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            <div className="flex rounded-lg border border-border-default overflow-hidden">
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className={cn(
                  "w-11 h-11 flex items-center justify-center transition-colors",
                  viewMode === "list"
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-dim hover:text-text-muted hover:bg-bg-secondary"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSearchParams({ view: "calendar" }, { replace: true })}
                className={cn(
                  "w-11 h-11 flex items-center justify-center transition-colors",
                  viewMode === "calendar"
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-dim hover:text-text-muted hover:bg-bg-secondary"
                )}
                title="Calendar view"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>
            {canGoForward && (
              <button
                onClick={() => navigate(1)}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                title="Forward"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </>
        }
      />
      {/* Session type filter pills — list view only */}
      {viewMode === "list" && (
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-4 border-b border-border-default">
          <div className="select-none">
            <div className="flex gap-1.5 overflow-x-auto mt-3 -mx-5 px-5 scrollbar-none">
              {allTypes.map((type) => {
                  const isActive = activeFilter === type
                  const isExcluded = type !== "all" && excludedTypes.has(type)
                  const count = type === "all"
                    ? sessions.length - sessions.filter((s) => excludedTypes.has(s.session_type)).length
                    : typeCounts[type] ?? 0
                  const canLongPress = activeFilter === "all"

                  return (
                    <SessionTypeFilterButton
                      key={type}
                      type={type}
                      isActive={isActive}
                      isExcluded={isExcluded}
                      count={count}
                      canLongPress={canLongPress}
                      onSelect={() => {
                        if (type === "all") {
                          setActiveFilter("all")
                          setExcludedTypes(new Set())
                        } else if (excludedTypes.has(type)) {
                          // Tap an excluded type to un-exclude it
                          setExcludedTypes((prev) => {
                            const next = new Set(prev)
                            next.delete(type)
                            return next
                          })
                        } else {
                          setActiveFilter(type)
                          setExcludedTypes(new Set())
                        }
                      }}
                      onLongPress={() => {
                        if (type === "all" || activeFilter !== "all") return
                        setExcludedTypes((prev) => {
                          const next = new Set(prev)
                          if (next.has(type)) next.delete(type)
                          else next.add(type)
                          return next
                        })
                      }}
                    />
                  )
              })}
            </div>
            {activeFilter === "all" && excludedTypes.size === 0 && (
                <p className="text-text-dim text-[10px] font-mono mt-1.5 ml-0.5 opacity-60">
                  Hold a type to exclude it
                </p>
              )}
            {activeFilter === "all" && excludedTypes.size > 0 && (
              <p className="text-upper-push/60 text-[10px] font-mono mt-1.5 ml-0.5">
                {excludedTypes.size} excluded — tap to restore
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {viewMode === "list" ? (
          <>
            {/* Planned workout */}
            {plannedSessions.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-core text-[11px] font-bold font-mono uppercase tracking-widest">
                    Next Workout
                  </span>
                  <div className="flex-1 h-px bg-core/20" />
                </div>
                <div className="flex flex-col gap-3">
                  {plannedSessions.map((s) => (
                    <PlannedWorkoutCard
                      key={s.id}
                      session={s}
                      onDismiss={() => queryClient.invalidateQueries({ queryKey: ['workouts', 'planned'] })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Deep-linked session */}

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
                {(activeFilter !== "all" || excludedTypes.size > 0) && sessions.length > 0 && (
                  <button
                    onClick={() => { setActiveFilter("all"); setExcludedTypes(new Set()) }}
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

        {/* Subtle guide link */}
        <div className="flex justify-center pt-8 pb-4">
          <Link
            to="/instructions/workouts"
            className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-text-muted transition-colors no-underline"
          >
            <FileText className="w-3 h-3" />
            Claude setup guide
          </Link>
        </div>
      </div>
    </div>
  )
}
