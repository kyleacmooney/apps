import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { usePersistedState } from "@/lib/use-persisted-state"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDataClient } from "@/context/SupabaseContext"
import { useAuth } from "@/context/AuthContext"
import { useCanGoForward } from "@/lib/use-can-go-forward"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/mobile/PageHeader"
import { friendlyError } from "@/lib/error-utils"
import { FilterButton, FilterRow } from "@/components/FilterButton"
import {
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Compass,
  Pencil,
  ExternalLink,
  BookOpen,
  FileText,
  Sigma,
  Brain,
  Shield,
  Wrench,
  GraduationCap,
  MoreHorizontal,
  Tag,
} from "lucide-react"

interface Interest {
  id: string
  user_id: string
  title: string
  url: string | null
  notes: string | null
  category: InterestCategory
  status: InterestStatus
  tags: string[]
  priority: number
  created_at: string
  updated_at: string
}

const CATEGORIES = ["book", "paper", "math", "ml", "alignment", "tool", "course", "other"] as const
type InterestCategory = (typeof CATEGORIES)[number]

const STATUSES = ["not_started", "in_progress", "done", "parked"] as const
type InterestStatus = (typeof STATUSES)[number]

const STATUS_LABELS: Record<InterestStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  parked: "Parked",
}

const CATEGORY_ICONS: Record<InterestCategory, typeof BookOpen> = {
  book: BookOpen,
  paper: FileText,
  math: Sigma,
  ml: Brain,
  alignment: Shield,
  tool: Wrench,
  course: GraduationCap,
  other: MoreHorizontal,
}

const CATEGORY_LABELS: Record<InterestCategory, string> = {
  book: "Book",
  paper: "Paper",
  math: "Math",
  ml: "ML",
  alignment: "Alignment",
  tool: "Tool",
  course: "Course",
  other: "Other",
}

const CATEGORY_COLORS: Record<InterestCategory, { text: string; bg: string; border: string }> = {
  book: { text: "text-upper-pull", bg: "bg-upper-pull-bg", border: "border-upper-pull-border" },
  paper: { text: "text-grip", bg: "bg-grip-bg", border: "border-grip-border" },
  math: { text: "text-core", bg: "bg-core-bg", border: "border-core-border" },
  ml: { text: "text-upper-push", bg: "bg-upper-push-bg", border: "border-upper-push-border" },
  alignment: { text: "text-lower", bg: "bg-lower-bg", border: "border-lower-border" },
  tool: { text: "text-cardio", bg: "bg-cardio-bg", border: "border-cardio-border" },
  course: { text: "text-mobility", bg: "bg-mobility-bg", border: "border-mobility-border" },
  other: { text: "text-text-muted", bg: "bg-bg-elevated", border: "border-border-default" },
}

const STATUS_COLORS: Record<InterestStatus, { text: string; bg: string; border: string }> = {
  not_started: { text: "text-text-dim", bg: "bg-bg-elevated", border: "border-border-default" },
  in_progress: { text: "text-ai", bg: "bg-ai-bg", border: "border-ai-border" },
  done: { text: "text-lower", bg: "bg-lower-bg", border: "border-lower-border" },
  parked: { text: "text-core", bg: "bg-core-bg", border: "border-core-border" },
}

const PRIORITY_DOTS: Record<number, string> = {
  1: "bg-text-dim",
  2: "bg-text-muted",
  3: "bg-text-secondary",
  4: "bg-core",
  5: "bg-upper-push",
}

type FilterMode = "all" | InterestStatus

function AddInterestForm({
  storagePrefix,
  onAdd,
  onCancel,
}: {
  storagePrefix: string
  onAdd: (item: {
    title: string
    url: string | null
    notes: string | null
    category: InterestCategory
    status: InterestStatus
    tags: string[]
    priority: number
  }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = usePersistedState(`${storagePrefix}:interests:add:title`, "")
  const [url, setUrl] = usePersistedState(`${storagePrefix}:interests:add:url`, "")
  const [notes, setNotes] = usePersistedState(`${storagePrefix}:interests:add:notes`, "")
  const [category, setCategory] = usePersistedState<InterestCategory>(`${storagePrefix}:interests:add:cat`, "other")
  const [priority, setPriority] = usePersistedState(`${storagePrefix}:interests:add:pri`, 3)
  const [tagInput, setTagInput] = usePersistedState(`${storagePrefix}:interests:add:tagInput`, "")
  const [tags, setTags] = usePersistedState<string[]>(`${storagePrefix}:interests:add:tags`, [])
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const resetForm = () => {
    setTitle("")
    setUrl("")
    setNotes("")
    setCategory("other")
    setPriority(3)
    setTagInput("")
    setTags([])
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      url: url.trim() || null,
      notes: notes.trim() || null,
      category,
      status: "not_started",
      tags,
      priority,
    })
    resetForm()
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-border-default p-4 overflow-hidden">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
        placeholder="What caught your interest?"
        className="w-full bg-transparent text-text-primary text-base font-medium placeholder:text-text-dim outline-none mb-3"
      />

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (optional)"
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover mb-3"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as InterestCategory)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[110px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>{p} — {p === 1 ? "Low" : p === 2 ? "Below avg" : p === 3 ? "Normal" : p === 4 ? "High" : "Urgent"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-3">
        <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Add tag…"
            className="flex-1 bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!tagInput.trim()}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-muted text-sm font-medium disabled:opacity-30 transition-colors"
          >
            <Tag className="w-4 h-4" />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-ai-bg text-ai border border-ai-border cursor-pointer"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X className="w-3 h-3" />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex-1 py-2.5 rounded-lg bg-core text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add Interest
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

function EditInterestForm({
  item,
  onSave,
  onCancel,
}: {
  item: Interest
  onSave: (updates: Partial<Interest>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [url, setUrl] = useState(item.url ?? "")
  const [notes, setNotes] = useState(item.notes ?? "")
  const [category, setCategory] = useState<InterestCategory>(item.category)
  const [status, setStatus] = useState<InterestStatus>(item.status)
  const [priority, setPriority] = useState(item.priority)
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>(item.tags)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      url: url.trim() || null,
      notes: notes.trim() || null,
      category,
      status,
      tags,
      priority,
    })
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-core-border p-4 overflow-hidden">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
        placeholder="What caught your interest?"
        className="w-full bg-transparent text-text-primary text-base font-medium placeholder:text-text-dim outline-none mb-3"
      />

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (optional)"
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover mb-3"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[100px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as InterestCategory)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[100px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InterestStatus)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[100px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-3">
        <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Add tag…"
            className="flex-1 bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!tagInput.trim()}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-muted text-sm font-medium disabled:opacity-30 transition-colors"
          >
            <Tag className="w-4 h-4" />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-ai-bg text-ai border border-ai-border cursor-pointer"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X className="w-3 h-3" />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="flex-1 py-2.5 rounded-lg bg-core text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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

function InterestItem({
  storagePrefix,
  item,
  onStatusChange,
  onDelete,
  onEdit,
  isEditing,
  onSaveEdit,
  onCancelEdit,
}: {
  storagePrefix: string
  item: Interest
  onStatusChange: (status: InterestStatus) => void
  onDelete: () => void
  onEdit: () => void
  isEditing: boolean
  onSaveEdit: (updates: Partial<Interest>) => void
  onCancelEdit: () => void
}) {
  const [expanded, setExpanded] = usePersistedState(`${storagePrefix}:interests:item:${item.id}`, false)
  const colors = CATEGORY_COLORS[item.category]
  const statusColors = STATUS_COLORS[item.status]
  const CategoryIcon = CATEGORY_ICONS[item.category]
  const isDone = item.status === "done"
  const isParked = item.status === "parked"

  if (isEditing) {
    return <EditInterestForm item={item} onSave={onSaveEdit} onCancel={onCancelEdit} />
  }

  const nextStatus: InterestStatus =
    item.status === "not_started" ? "in_progress" :
    item.status === "in_progress" ? "done" :
    item.status === "done" ? "not_started" :
    "not_started"

  return (
    <div
      className={cn(
        "rounded-xl bg-bg-secondary border transition-all",
        isDone ? "border-border-default opacity-50" : isParked ? "border-core-border/30 opacity-60" : "border-border-default"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Status cycle button */}
        <button
          onClick={() => onStatusChange(nextStatus)}
          className={cn(
            "mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
            statusColors.bg, statusColors.border, statusColors.text
          )}
          title={`Mark as ${STATUS_LABELS[nextStatus]}`}
        >
          <CategoryIcon className="w-3.5 h-3.5" />
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
              {item.title}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={cn("w-2 h-2 rounded-full", PRIORITY_DOTS[item.priority] ?? "bg-text-secondary")} />
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  colors.text, colors.bg
                )}
              >
                {CATEGORY_LABELS[item.category]}
              </span>
            </div>
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-[11px] font-mono px-1.5 py-0.5 rounded", statusColors.text, statusColors.bg)}>
              {STATUS_LABELS[item.status]}
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-upper-pull flex items-center gap-0.5 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Link
              </a>
            )}
            {item.tags.length > 0 && (
              <span className="text-[11px] text-text-dim font-mono">
                {item.tags.length} tag{item.tags.length !== 1 ? "s" : ""}
              </span>
            )}
            {(item.notes || item.tags.length > 0 || expanded) && (
              <ChevronDown className={cn("w-3 h-3 text-text-dim ml-auto transition-transform", expanded && "rotate-180")} />
            )}
          </div>

          {/* Expanded details */}
          {expanded && (
            <>
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-ai-bg text-ai border border-ai-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-text-secondary text-sm mt-2 mb-0 leading-relaxed whitespace-pre-wrap">
                  {item.notes}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-default">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-text-dim text-xs hover:text-core hover:bg-core-bg transition-colors"
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Interests() {
  const supabase = useDataClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const queryClient = useQueryClient()

  const storagePrefix = user?.id ?? "guest"
  const [filterMode, setFilterMode] = usePersistedState<FilterMode>(`${storagePrefix}:interests:filter`, "all")
  const [categoryFilter, setCategoryFilter] = usePersistedState<InterestCategory | "all">(`${storagePrefix}:interests:catFilter`, "all")
  const [excludedCategories, setExcludedCategories] = usePersistedState<Set<string>>(`${storagePrefix}:interests:excludedCats`, new Set())
  const [showAddForm, setShowAddForm] = usePersistedState(`${storagePrefix}:interests:showAdd`, false)
  const [editingId, setEditingId] = usePersistedState<string | null>(`${storagePrefix}:interests:editingId`, null)

  const itemsQuery = useQuery({
    queryKey: ["interests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interests")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as Interest[]
    },
  })

  const items = itemsQuery.data ?? []
  const loading = itemsQuery.isLoading
  const error = itemsQuery.error?.message ?? null
  const refreshing = itemsQuery.isRefetching

  const addMutation = useMutation({
    mutationFn: async (newItem: {
      title: string
      url: string | null
      notes: string | null
      category: InterestCategory
      status: InterestStatus
      tags: string[]
      priority: number
    }) => {
      const { error } = await supabase.from("interests").insert({
        ...newItem,
        user_id: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interests"] })
      setShowAddForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Interest> }) => {
      const { error } = await supabase
        .from("interests")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interests"] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interests").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interests"] }),
  })

  const filteredItems = useMemo(() => {
    let result = items

    if (filterMode !== "all") {
      result = result.filter((i) => i.status === filterMode)
    }
    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category === categoryFilter)
    } else if (excludedCategories.size > 0) {
      result = result.filter((i) => !excludedCategories.has(i.category))
    }

    return [...result].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1
      if (a.status !== "done" && b.status === "done") return -1
      if (a.status === "parked" && b.status !== "parked") return 1
      if (a.status !== "parked" && b.status === "parked") return -1

      const pDiff = b.priority - a.priority
      if (pDiff !== 0) return pDiff

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [items, filterMode, categoryFilter, excludedCategories])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length, not_started: 0, in_progress: 0, done: 0, parked: 0 }
    for (const i of items) {
      counts[i.status] = (counts[i.status] ?? 0) + 1
    }
    return counts
  }, [items])

  const handleStatusChange = useCallback((id: string, status: InterestStatus) => {
    updateMutation.mutate({ id, updates: { status } })
  }, [updateMutation])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-core rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading interests...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-upper-push-bg border border-upper-push-border rounded-xl p-6 max-w-sm text-center">
          <p className="text-upper-push font-semibold mb-2">Failed to load interests</p>
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
              Interests
            </h1>
            <span className="text-text-dim text-xs font-mono font-medium">
              {filterMode === "all" && categoryFilter === "all"
                ? items.filter((i) => i.status !== "done").length
                : filteredItems.filter((i) => i.status !== "done").length}{" "}
              active
            </span>
          </>
        }
        subtitle="Things to explore, learn & revisit"
        sticky
        rightActions={
          <>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["interests"] })}
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
                  ? "text-core bg-core-bg"
                  : "text-text-dim hover:text-core hover:bg-bg-secondary"
              )}
              title={showAddForm ? "Close form" : "Add interest"}
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
        <FilterRow className="mt-3">
          {(["all", "not_started", "in_progress", "done", "parked"] as const).map((mode) => (
            <FilterButton
              key={mode}
              label={mode === "all" ? "All" : STATUS_LABELS[mode as InterestStatus]}
              count={statusCounts[mode] ?? 0}
              isActive={filterMode === mode}
              style={mode === "all"
                ? { text: "text-core", bg: "bg-core-bg", border: "border-core-border" }
                : STATUS_COLORS[mode as InterestStatus]}
              onSelect={() => setFilterMode(mode)}
            />
          ))}
        </FilterRow>

        {/* Category filter pills */}
        <FilterRow
          className="mt-2"
          canExclude={categoryFilter === "all"}
          excludedCount={excludedCategories.size}
          hint="Hold a category to exclude it"
        >
          <FilterButton
            label="All"
            count={items.length - items.filter((i) => excludedCategories.has(i.category)).length}
            isActive={categoryFilter === "all"}
            size="sm"
            onSelect={() => {
              setCategoryFilter("all")
              setExcludedCategories(new Set())
            }}
          />
          {CATEGORIES.map((cat) => {
            const colors = CATEGORY_COLORS[cat]
            const count = items.filter((i) => i.category === cat).length
            const isExcluded = excludedCategories.has(cat)
            if (count === 0 && categoryFilter !== cat && !isExcluded) return null
            return (
              <FilterButton
                key={cat}
                label={CATEGORY_LABELS[cat]}
                count={count}
                isActive={categoryFilter === cat}
                isExcluded={isExcluded}
                style={colors}
                size="sm"
                canExclude={categoryFilter === "all"}
                onSelect={() => {
                  if (isExcluded) {
                    setExcludedCategories((prev) => {
                      const next = new Set(prev)
                      next.delete(cat)
                      return next
                    })
                  } else {
                    setCategoryFilter(cat)
                    setExcludedCategories(new Set())
                  }
                }}
                onExclude={() => {
                  setExcludedCategories((prev) => {
                    const next = new Set(prev)
                    if (next.has(cat)) next.delete(cat)
                    else next.add(cat)
                    return next
                  })
                }}
              />
            )
          })}
        </FilterRow>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {showAddForm && (
          <div className="mb-4">
            <AddInterestForm
              storagePrefix={storagePrefix}
              onAdd={(item) => addMutation.mutate(item)}
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
        {items.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-20">
            <Compass className="w-12 h-12 text-text-dim mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Nothing here yet
            </h2>
            <p className="text-text-muted text-sm text-center max-w-xs mb-6">
              Track books, papers, tools, research topics, and rabbit holes you want to explore.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 rounded-lg bg-core text-bg-primary text-sm font-semibold transition-colors"
            >
              Add your first interest
            </button>
          </div>
        )}

        {/* Filtered empty state */}
        {items.length > 0 && filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">No interests match this filter.</p>
            <button
              onClick={() => { setFilterMode("all"); setCategoryFilter("all") }}
              className="text-core text-sm mt-2 hover:underline"
            >
              Show all interests
            </button>
          </div>
        )}

        {/* Item list */}
        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => (
            <InterestItem
              key={item.id}
              storagePrefix={storagePrefix}
              item={item}
              onStatusChange={(status) => handleStatusChange(item.id, status)}
              onDelete={() => deleteMutation.mutate(item.id)}
              onEdit={() => setEditingId(item.id)}
              isEditing={editingId === item.id}
              onSaveEdit={(updates) => updateMutation.mutate({ id: item.id, updates })}
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
              {statusCounts.done} completed {statusCounts.done === 1 ? "item" : "items"}
            </button>
          </div>
        )}

        {/* Subtle guide link */}
        <div className="flex justify-center pt-8 pb-4">
          <Link
            to="/instructions/interests"
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
