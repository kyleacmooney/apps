/** Parse a date-only string (YYYY-MM-DD) as local time, not UTC. */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Get the Monday (week start) for a given YYYY-MM-DD date string. Returns YYYY-MM-DD. */
export function getWeekStartStr(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0 offset
  date.setDate(date.getDate() - diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Human-readable label for a week starting on the given Monday (YYYY-MM-DD). */
export function getWeekLabel(weekStartStr: string): string {
  const weekStart = parseLocalDate(weekStartStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const todayWeekStart = (() => {
    const d = new Date(now)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d
  })()

  const diffMs = todayWeekStart.getTime() - weekStart.getTime()
  const diffWeeks = Math.round(diffMs / (7 * 86400000))

  if (diffWeeks === 0) return "This Week"
  if (diffWeeks === 1) return "Last Week"

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${fmt(weekStart)} \u2013 ${fmt(weekEnd)}`
}

export interface TrendSet {
  set_number: number
  reps: number | null
  weight: number | null
  weight_unit: string
  duration_seconds: number | null
  is_pr: boolean
  notes: string | null
}

export function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m}:00`
  }
  return `${seconds}s`
}

export function formatSet(set: TrendSet): string {
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

export function relativeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
