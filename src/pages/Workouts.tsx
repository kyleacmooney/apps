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
