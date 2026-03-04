import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Calendar, Zap, FileText, ChevronDown, ChevronRight, Trophy, MapPin, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkoutSet {
  id: string
  set_number: number
  reps: number | null
  weight: number | null
  weight_unit: string
  duration_seconds: number | null
  is_pr: boolean
  notes: string | null
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
  time_of_day: string | null
  location: string | null
  notes: string | null
  workout_exercises: WorkoutExercise[]
}

/** Parse a date-only string (YYYY-MM-DD) as local time, not UTC. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const SECTION_ORDER = ["warmup", "main", "accessory"] as const
const SECTION_LABELS: Record<string, string> = {
  warmup: "Warmup",
  main: "Main",
  accessory: "Accessory",
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`
  }
  return `${seconds}s`
}

function formatSet(set: WorkoutSet): string {
  const parts: string[] = []
  if (set.reps != null) {
    parts.push(`${set.reps}`)
    if (set.weight != null) {
      parts.push(`× ${set.weight}${set.weight_unit}`)
    }
  } else if (set.duration_seconds != null) {
    parts.push(formatDuration(set.duration_seconds))
    if (set.weight != null) {
      parts.push(`@ ${set.weight}${set.weight_unit}`)
    }
  }
  return parts.join(" ")
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
          <span className="text-text-primary text-[13.5px] font-medium truncate">
            {exercise.exercise_name}
          </span>
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
      )}
    </div>
  )
}

function SessionCard({
  session,
  isSessionExpanded,
  onToggleSession,
}: {
  session: WorkoutSession
  isSessionExpanded: boolean
  onToggleSession: () => void
}) {
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const exercises = session.workout_exercises

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
    <div className="rounded-xl bg-bg-secondary border border-border-default p-4 sm:p-5">
      {/* Session header — clickable to expand/collapse */}
      <div
        onClick={onToggleSession}
        className="cursor-pointer select-none"
      >
        <div className="flex items-start justify-between mb-2">
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
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-text-dim" />
                    <span className="text-text-muted text-xs font-mono">
                      {session.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-semibold font-mono uppercase tracking-wide px-2.5 py-1 rounded-md bg-cardio-tag text-cardio">
            {session.session_type}
          </span>
        </div>

        {(session.energy_rating != null || session.energy_level) && (
          <div className="flex items-center gap-2 ml-6">
            {session.energy_rating != null ? (
              <EnergyBar level={session.energy_rating} />
            ) : (
              <Zap className="w-3.5 h-3.5 text-core" />
            )}
            {session.energy_level && (
              <span className="text-text-muted text-xs font-mono">
                {session.energy_level}
              </span>
            )}
          </div>
        )}

        {/* Summary line when collapsed */}
        {!isSessionExpanded && exerciseCount > 0 && (
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
                        isExpanded={expandedExerciseId === ex.id}
                        onToggle={() =>
                          setExpandedExerciseId(
                            expandedExerciseId === ex.id ? null : ex.id
                          )
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

export function Workouts() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(`
          id, date, title, session_type, energy_level, energy_rating, time_of_day, location, notes,
          workout_exercises (
            id, exercise_name, section, position, notes,
            workout_sets (
              id, set_number, reps, weight, weight_unit,
              duration_seconds, is_pr, notes
            )
          )
        `)
        .order("date", { ascending: false })
        .limit(20)

      if (error) {
        setError(error.message)
      } else {
        const loaded = data ?? []
        setSessions(loaded)
        // Default: most recent session expanded
        if (loaded.length > 0) {
          setExpandedSessionIds(new Set([loaded[0].id]))
        }
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
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isSessionExpanded={expandedSessionIds.has(s.id)}
                onToggleSession={() =>
                  setExpandedSessionIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(s.id)) {
                      next.delete(s.id)
                    } else {
                      next.add(s.id)
                    }
                    return next
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
