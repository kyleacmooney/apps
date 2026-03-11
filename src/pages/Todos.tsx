import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePersistedState } from "@/lib/use-persisted-state"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDataClient } from "@/context/SupabaseContext"
import { useAuth } from "@/context/AuthContext"
import { useCanGoForward } from "@/lib/use-can-go-forward"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/mobile/PageHeader"
import { friendlyError } from "@/lib/error-utils"
import {
  ArrowRight,
  RefreshCw,
  Plus,
  Check,
  Trash2,
  ChevronDown,
  X,
  Calendar,
  Repeat,
  AlertTriangle,
  ListTodo,
  Pencil,
} from "lucide-react"

interface Todo {
  id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "done" | "recurring"
  category: Category
  recurring_interval: "daily" | "weekly" | "monthly" | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

const CATEGORIES = ["errands", "health", "admin", "home", "work", "personal"] as const
type Category = (typeof CATEGORIES)[number]

const PRIORITIES = ["low", "medium", "high", "urgent"] as const
type Priority = (typeof PRIORITIES)[number]

const CATEGORY_COLORS: Record<Category, { text: string; bg: string; border: string }> = {
  errands: { text: "text-cardio", bg: "bg-cardio-bg", border: "border-cardio-border" },
  health: { text: "text-lower", bg: "bg-lower-bg", border: "border-lower-border" },
  admin: { text: "text-upper-pull", bg: "bg-upper-pull-bg", border: "border-upper-pull-border" },
  home: { text: "text-core", bg: "bg-core-bg", border: "border-core-border" },
  work: { text: "text-grip", bg: "bg-grip-bg", border: "border-grip-border" },
  personal: { text: "text-ai", bg: "bg-ai-bg", border: "border-ai-border" },
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "text-text-dim",
  medium: "text-text-muted",
  high: "text-core",
  urgent: "text-upper-push",
}

const PRIORITY_DOTS: Record<Priority, string> = {
  low: "bg-text-dim",
  medium: "bg-text-muted",
  high: "bg-core",
  urgent: "bg-upper-push",
}

type FilterMode = "all" | "pending" | "done" | "recurring"

function formatDueDate(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split("-").map(Number)
  const due = new Date(y, m - 1, d)

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (diffDays > 0 && diffDays <= 6)
    return due.toLocaleDateString("en-US", { weekday: "short" })
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isDueOverdue(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split("-").map(Number)
  const due = new Date(y, m - 1, d)
  return due < today
}

function isDueToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0]
  return dateStr === today
}

function AddTodoForm({
  storagePrefix,
  onAdd,
  onCancel,
}: {
  storagePrefix: string
  onAdd: (todo: {
    title: string
    description: string | null
    due_date: string | null
    priority: Priority
    category: Category
    status: "pending" | "recurring"
    recurring_interval: "daily" | "weekly" | "monthly" | null
  }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = usePersistedState(`${storagePrefix}:todos:add:title`, "")
  const [description, setDescription] = usePersistedState(`${storagePrefix}:todos:add:desc`, "")
  const [dueDate, setDueDate] = usePersistedState(`${storagePrefix}:todos:add:due`, "")
  const [priority, setPriority] = usePersistedState<Priority>(`${storagePrefix}:todos:add:priority`, "medium")
  const [category, setCategory] = usePersistedState<Category>(`${storagePrefix}:todos:add:category`, "personal")
  const [isRecurring, setIsRecurring] = usePersistedState(`${storagePrefix}:todos:add:recurring`, false)
  const [recurringInterval, setRecurringInterval] = usePersistedState<"daily" | "weekly" | "monthly">(`${storagePrefix}:todos:add:interval`, "daily")
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setDueDate("")
    setPriority("medium")
    setCategory("personal")
    setIsRecurring(false)
    setRecurringInterval("daily")
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      priority,
      category,
      status: isRecurring ? "recurring" : "pending",
      recurring_interval: isRecurring ? recurringInterval : null,
    })
    resetForm()
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-border-default p-4">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
        placeholder="What needs to be done?"
        className="w-full bg-transparent text-text-primary text-base font-medium placeholder:text-text-dim outline-none mb-3"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[110px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="min-w-0">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
        </div>

        <div className="min-w-0">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Recurring</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "px-3 py-2 rounded-lg border text-base transition-colors",
                isRecurring
                  ? "bg-ai-bg border-ai-border text-ai"
                  : "bg-bg-elevated border-border-default text-text-dim"
              )}
            >
              <Repeat className="w-4 h-4" />
            </button>
            {isRecurring && (
              <select
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(e.target.value as "daily" | "weekly" | "monthly")}
                className="flex-1 min-w-[140px] bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex-1 py-2.5 rounded-lg bg-ai text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add Todo
        </button>
        <button
          onClick={() => { resetForm(); onCancel() }}
          className="px-4 py-2.5 rounded-lg border border-border-default text-text-muted text-sm font-semibold hover:bg-bg-elevated transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function EditTodoForm({
  todo,
  onSave,
  onCancel,
}: {
  todo: Todo
  onSave: (updates: Partial<Todo>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description ?? "")
  const [dueDate, setDueDate] = useState(todo.due_date ?? "")
  const [priority, setPriority] = useState<Priority>(todo.priority)
  const [category, setCategory] = useState<Category>(todo.category)
  const [isRecurring, setIsRecurring] = useState(todo.status === "recurring")
  const [recurringInterval, setRecurringInterval] = useState<"daily" | "weekly" | "monthly">(todo.recurring_interval ?? "daily")
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      priority,
      category,
      status: isRecurring ? "recurring" : (todo.status === "done" ? "done" : "pending"),
      recurring_interval: isRecurring ? recurringInterval : null,
    })
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-ai-border p-4">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
        placeholder="What needs to be done?"
        className="w-full bg-transparent text-text-primary text-base font-medium placeholder:text-text-dim outline-none mb-3"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[110px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="min-w-0">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
        </div>

        <div className="min-w-0">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Recurring</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "px-3 py-2 rounded-lg border text-base transition-colors",
                isRecurring
                  ? "bg-ai-bg border-ai-border text-ai"
                  : "bg-bg-elevated border-border-default text-text-dim"
              )}
            >
              <Repeat className="w-4 h-4" />
            </button>
            {isRecurring && (
              <select
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(e.target.value as "daily" | "weekly" | "monthly")}
                className="flex-1 min-w-[140px] bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none capitalize appearance-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex-1 py-2.5 rounded-lg bg-ai text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-border-default text-text-muted text-sm font-semibold hover:bg-bg-elevated transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function TodoItem({
  storagePrefix,
  todo,
  onToggle,
  onDelete,
  onEdit,
  isEditing,
  onSaveEdit,
  onCancelEdit,
}: {
  storagePrefix: string
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onEdit: () => void
  isEditing: boolean
  onSaveEdit: (updates: Partial<Todo>) => void
  onCancelEdit: () => void
}) {
  const [expanded, setExpanded] = usePersistedState(`${storagePrefix}:todos:item:${todo.id}`, false)
  const isDone = todo.status === "done"
  const isRecurring = todo.status === "recurring"
  const colors = CATEGORY_COLORS[todo.category]
  const overdue = todo.due_date && !isDone && isDueOverdue(todo.due_date)
  const dueToday = todo.due_date && !isDone && isDueToday(todo.due_date)

  if (isEditing) {
    return <EditTodoForm todo={todo} onSave={onSaveEdit} onCancel={onCancelEdit} />
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-bg-secondary border transition-all",
        isDone ? "border-border-default opacity-50" : "border-border-default",
        overdue && "border-upper-push-border/50"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Check button */}
        <button
          onClick={onToggle}
          className={cn(
            "mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
            isDone
              ? "border-lower bg-lower/20 text-lower"
              : isRecurring
                ? "border-ai text-transparent hover:text-ai/50"
                : "border-text-dim text-transparent hover:text-text-dim/50"
          )}
        >
          {isDone ? (
            <Check className="w-3.5 h-3.5" />
          ) : isRecurring ? (
            <Repeat className="w-3 h-3" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Content */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "text-[14px] font-medium m-0 break-words min-w-0",
                isDone ? "text-text-dim line-through" : "text-text-primary"
              )}
            >
              {todo.title}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={cn("w-2 h-2 rounded-full", PRIORITY_DOTS[todo.priority])} />
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  colors.text, colors.bg
                )}
              >
                {todo.category}
              </span>
            </div>
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {todo.due_date && (
              <span
                className={cn(
                  "text-[11px] font-mono flex items-center gap-1",
                  overdue ? "text-upper-push" : dueToday ? "text-core" : "text-text-dim"
                )}
              >
                <Calendar className="w-3 h-3" />
                {formatDueDate(todo.due_date)}
                {overdue && <AlertTriangle className="w-3 h-3" />}
              </span>
            )}
            {isRecurring && todo.recurring_interval && (
              <span className="text-[11px] font-mono text-ai flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {todo.recurring_interval}
              </span>
            )}
            {todo.priority !== "medium" && (
              <span className={cn("text-[11px] font-mono capitalize", PRIORITY_STYLES[todo.priority])}>
                {todo.priority}
              </span>
            )}
            {(todo.description || expanded) && (
              <ChevronDown className={cn("w-3 h-3 text-text-dim ml-auto transition-transform", expanded && "rotate-180")} />
            )}
          </div>

          {/* Expanded details */}
          {expanded && todo.description && (
            <p className="text-text-secondary text-sm mt-2 mb-0 leading-relaxed whitespace-pre-wrap">
              {todo.description}
            </p>
          )}

          {/* Expanded actions */}
          {expanded && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-default">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-text-dim text-xs hover:text-ai hover:bg-ai-bg transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-text-dim text-xs hover:text-upper-push hover:bg-upper-push-bg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Todos() {
  const supabase = useDataClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const queryClient = useQueryClient()

  const storagePrefix = user?.id ?? "guest"
  const [filterMode, setFilterMode] = usePersistedState<FilterMode>(`${storagePrefix}:todos:filter`, "all")
  const [categoryFilter, setCategoryFilter] = usePersistedState<Category | "all">(`${storagePrefix}:todos:catFilter`, "all")
  const [showAddForm, setShowAddForm] = usePersistedState(`${storagePrefix}:todos:showAdd`, false)
  const [editingId, setEditingId] = usePersistedState<string | null>(`${storagePrefix}:todos:editingId`, null)

  const todosQuery = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as Todo[]
    },
  })

  const todos = todosQuery.data ?? []
  const loading = todosQuery.isLoading
  const error = todosQuery.error?.message ?? null
  const refreshing = todosQuery.isRefetching

  const addMutation = useMutation({
    mutationFn: async (newTodo: {
      title: string
      description: string | null
      due_date: string | null
      priority: Priority
      category: Category
      status: "pending" | "recurring"
      recurring_interval: "daily" | "weekly" | "monthly" | null
    }) => {
      const { error } = await supabase.from("todos").insert({
        ...newTodo,
        user_id: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      setShowAddForm(false)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (todo: Todo) => {
      const newStatus = todo.status === "done" ? "pending" : "done"
      const { error } = await supabase
        .from("todos")
        .update({
          status: newStatus,
          completed_at: newStatus === "done" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", todo.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Todo> }) => {
      const { error } = await supabase
        .from("todos")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      setEditingId(null)
    },
  })

  const filteredTodos = useMemo(() => {
    let result = todos

    if (filterMode !== "all") {
      result = result.filter((t) => t.status === filterMode)
    }
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter)
    }

    return [...result].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1
      if (a.status !== "done" && b.status === "done") return -1

      const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff

      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [todos, filterMode, categoryFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: todos.length, pending: 0, done: 0, recurring: 0 }
    for (const t of todos) {
      counts[t.status] = (counts[t.status] ?? 0) + 1
    }
    return counts
  }, [todos])

  const handleToggle = useCallback((todo: Todo) => {
    if (todo.status === "recurring") return
    toggleMutation.mutate(todo)
  }, [toggleMutation])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-ai rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading todos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-upper-push-bg border border-upper-push-border rounded-xl p-6 max-w-sm text-center">
          <p className="text-upper-push font-semibold mb-2">Failed to load todos</p>
          <p className="text-text-muted text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      <PageHeader
        title={
          <>
            <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
              Todos
            </h1>
            <span className="text-text-dim text-xs font-mono font-medium">
              {filterMode === "all" && categoryFilter === "all"
                ? statusCounts.pending
                : filteredTodos.filter((t) => t.status !== "done").length}{" "}
              active
            </span>
          </>
        }
        subtitle="Daily tasks & responsibilities"
        sticky
        rightActions={
          <>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["todos"] })}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-text-dim hover:text-text-muted hover:bg-bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={cn(
                "w-11 h-11 flex items-center justify-center rounded-lg transition-colors",
                showAddForm
                  ? "text-ai bg-ai-bg"
                  : "text-text-dim hover:text-ai hover:bg-bg-secondary"
              )}
              title={showAddForm ? "Close form" : "Add todo"}
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
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
      <div className="max-w-2xl mx-auto px-5 pb-4 border-b border-border-default overflow-hidden">
        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto mt-3 -mx-5 px-5 scrollbar-none">
          {(["all", "pending", "done", "recurring"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap capitalize transition-all",
                filterMode === mode
                  ? "border-ai-border bg-ai-bg text-ai"
                  : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
              )}
            >
              {mode === "all" ? "All" : mode === "pending" ? "Active" : mode === "done" ? "Done" : "Recurring"}
              <span className="ml-1 opacity-60 font-mono text-[11px]">
                {statusCounts[mode] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 overflow-x-auto mt-2 -mx-5 px-5 scrollbar-none">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all",
              categoryFilter === "all"
                ? "border-text-muted/40 bg-text-muted/20 text-text-secondary"
                : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const colors = CATEGORY_COLORS[cat]
            const count = todos.filter((t) => t.category === cat).length
            if (count === 0 && categoryFilter !== cat) return null
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer whitespace-nowrap capitalize transition-all",
                  categoryFilter === cat
                    ? cn(colors.text, colors.bg, colors.border)
                    : "border-border-default bg-transparent text-text-dim hover:text-text-muted"
                )}
              >
                {cat}
                <span className="ml-1 opacity-60 font-mono">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {/* Add form */}
        {showAddForm && (
          <div className="mb-4">
            <AddTodoForm
              storagePrefix={storagePrefix}
              onAdd={(todo) => addMutation.mutate(todo)}
              onCancel={() => setShowAddForm(false)}
            />
            {addMutation.error && (
              <p className="text-upper-push text-xs mt-2">
                {friendlyError(addMutation.error)}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {todos.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-20">
            <ListTodo className="w-12 h-12 text-text-dim mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No todos yet
            </h2>
            <p className="text-text-muted text-sm text-center max-w-xs mb-6">
              Add tasks here or use Claude with the Supabase MCP connector to manage your todos by conversation.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 rounded-lg bg-ai text-bg-primary text-sm font-semibold transition-colors"
            >
              Add your first todo
            </button>
          </div>
        )}

        {/* Filtered empty state */}
        {todos.length > 0 && filteredTodos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">No todos match this filter.</p>
            <button
              onClick={() => { setFilterMode("all"); setCategoryFilter("all") }}
              className="text-ai text-sm mt-2 hover:underline"
            >
              Show all todos
            </button>
          </div>
        )}

        {/* Todo list */}
        <div className="flex flex-col gap-2">
          {filteredTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              storagePrefix={storagePrefix}
              todo={todo}
              onToggle={() => handleToggle(todo)}
              onDelete={() => deleteMutation.mutate(todo.id)}
              onEdit={() => setEditingId(todo.id)}
              isEditing={editingId === todo.id}
              onSaveEdit={(updates) => editMutation.mutate({ id: todo.id, updates })}
              onCancelEdit={() => setEditingId(null)}
            />
          ))}
        </div>

        {/* Completed count footer */}
        {statusCounts.done > 0 && filterMode !== "done" && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setFilterMode(filterMode === "all" ? "done" : "all")}
              className="text-text-dim text-xs font-mono hover:text-text-muted transition-colors"
            >
              {statusCounts.done} completed {statusCounts.done === 1 ? "task" : "tasks"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
