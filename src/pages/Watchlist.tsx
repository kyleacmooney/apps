import { useState, useMemo, useCallback, useRef, useEffect, type RefObject } from "react"
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
import { searchTmdbTitles, type TmdbTitleSuggestion } from "@/lib/tmdb"
import {
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Film,
  Tv,
  Pencil,
  Star,
  Tag,
  Eye,
  EyeOff,
  Clapperboard,
  FileText,
} from "lucide-react"

interface WatchlistItem {
  id: string
  user_id: string
  title: string
  media_type: MediaType
  status: WatchStatus
  rating: number | null
  notes: string | null
  tags: string[]
  year: number | null
  created_at: string
  updated_at: string
}

const MEDIA_TYPES = ["movie", "show"] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const WATCH_STATUSES = ["want", "watching", "watched"] as const
type WatchStatus = (typeof WATCH_STATUSES)[number]

const STATUS_LABELS: Record<WatchStatus, string> = {
  want: "Want to Watch",
  watching: "Watching",
  watched: "Watched",
}

const STATUS_SHORT_LABELS: Record<WatchStatus, string> = {
  want: "Want",
  watching: "Watching",
  watched: "Watched",
}

const TYPE_ICONS: Record<MediaType, typeof Film> = {
  movie: Film,
  show: Tv,
}

const STATUS_COLORS: Record<WatchStatus, { text: string; bg: string; border: string }> = {
  want: { text: "text-upper-pull", bg: "bg-upper-pull-bg", border: "border-upper-pull-border" },
  watching: { text: "text-ai", bg: "bg-ai-bg", border: "border-ai-border" },
  watched: { text: "text-lower", bg: "bg-lower-bg", border: "border-lower-border" },
}

const TYPE_COLORS: Record<MediaType, { text: string; bg: string; border: string }> = {
  movie: { text: "text-upper-push", bg: "bg-upper-push-bg", border: "border-upper-push-border" },
  show: { text: "text-cardio", bg: "bg-cardio-bg", border: "border-cardio-border" },
}

type FilterMode = "all" | WatchStatus

function TitleAutocompleteInput({
  title,
  setTitle,
  year,
  setYear,
  mediaType,
  setMediaType,
  inputRef,
  onSubmit,
}: {
  title: string
  setTitle: (value: string) => void
  year: string
  setYear: (value: string) => void
  mediaType: MediaType
  setMediaType: (value: MediaType) => void
  inputRef: RefObject<HTMLInputElement | null>
  onSubmit: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { session } = useAuth()
  const [debouncedTitle, setDebouncedTitle] = useState(title)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [autofillNotice, setAutofillNotice] = useState<{
    previousTitle: string
    previousYear: string
    previousMediaType: MediaType
  } | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTitle(title.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [title])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    return () => window.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const { data: suggestions = [], isFetching: suggestionsLoading, error: suggestionsError } = useQuery({
    queryKey: ["watchlist", "title-search", debouncedTitle],
    queryFn: () => searchTmdbTitles({ query: debouncedTitle, accessToken: session?.access_token }),
    enabled: debouncedTitle.length >= 2,
    staleTime: 60_000,
  })

  useEffect(() => {
    setHighlightedIndex(0)
  }, [suggestions])

  const applySuggestion = (suggestion: TmdbTitleSuggestion) => {
    const previous = {
      previousTitle: title,
      previousYear: year,
      previousMediaType: mediaType,
    }

    setTitle(suggestion.title)
    if (suggestion.year !== null) {
      setYear(String(suggestion.year))
    }
    if (suggestion.kind !== "other") {
      setMediaType(suggestion.kind)
    }
    setShowSuggestions(false)
    setAutofillNotice(previous)

    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setAutofillNotice(null)
      noticeTimerRef.current = null
    }, 7000)
  }

  const undoAutofill = () => {
    if (!autofillNotice) return
    setTitle(autofillNotice.previousTitle)
    setYear(autofillNotice.previousYear)
    setMediaType(autofillNotice.previousMediaType)
    setAutofillNotice(null)
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
    inputRef.current?.focus()
  }

  const canShowSuggestions = showSuggestions && title.trim().length >= 2

  return (
    <div ref={containerRef} className="mb-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (canShowSuggestions && suggestions.length > 0 && e.key === "ArrowDown") {
              e.preventDefault()
              setHighlightedIndex((idx) => (idx + 1) % suggestions.length)
              return
            }
            if (canShowSuggestions && suggestions.length > 0 && e.key === "ArrowUp") {
              e.preventDefault()
              setHighlightedIndex((idx) => (idx - 1 + suggestions.length) % suggestions.length)
              return
            }
            if (e.key === "Escape") {
              setShowSuggestions(false)
              return
            }
            if (e.key === "Enter") {
              if (canShowSuggestions && suggestions[highlightedIndex]) {
                e.preventDefault()
                applySuggestion(suggestions[highlightedIndex])
                return
              }
              onSubmit()
            }
          }}
          placeholder="Movie or show title"
          className="w-full bg-transparent text-text-primary text-base font-medium placeholder:text-text-dim outline-none"
        />

        {canShowSuggestions && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-border-default bg-bg-elevated shadow-xl max-h-56 overflow-y-auto">
            {suggestionsLoading && <div className="px-3 py-2 text-sm text-text-muted">Searching TMDB…</div>}

            {!suggestionsLoading && suggestionsError && (
              <div className="px-3 py-2 text-sm text-amber-300">Couldn&apos;t load suggestions. Keep typing to add manually.</div>
            )}

            {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-muted">No TMDB matches. You can still add this title manually.</div>
            )}

            {!suggestionsLoading && suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.kind}-${suggestion.id}`}
                type="button"
                onClick={() => applySuggestion(suggestion)}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors",
                  highlightedIndex === index ? "bg-bg-secondary" : "hover:bg-bg-secondary"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-text-primary truncate">{suggestion.title}</span>
                  <span className="block text-xs text-text-muted">
                    {suggestion.year ?? "Unknown year"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase",
                    suggestion.kind === "movie" && "text-upper-push bg-upper-push-bg border-upper-push-border",
                    suggestion.kind === "show" && "text-cardio bg-cardio-bg border-cardio-border",
                    suggestion.kind === "other" && "text-text-muted bg-bg-secondary border-border-default"
                  )}
                >
                  {suggestion.kind}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {autofillNotice && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-ai-border bg-ai-bg px-3 py-2 text-xs text-ai">
          <span>Autofilled from TMDB. You can keep it or undo.</span>
          <button
            type="button"
            onClick={undoAutofill}
            className="rounded-md border border-ai-border px-2 py-1 font-semibold hover:bg-bg-secondary transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

function StarRating({
  value,
  onChange,
  size = "sm",
  readonly = false,
}: {
  value: number | null
  onChange?: (rating: number | null) => void
  size?: "sm" | "md"
  readonly?: boolean
}) {
  const iconSize = size === "md" ? "w-6 h-6" : "w-4 h-4"
  const gap = size === "md" ? "gap-1" : "gap-0.5"

  return (
    <div className={cn("flex items-center", gap)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => {
            if (readonly || !onChange) return
            onChange(value === star ? null : star)
          }}
          className={cn(
            "transition-all",
            readonly ? "cursor-default" : "cursor-pointer active:scale-125",
            value !== null && star <= value ? "text-core" : "text-text-dim/40"
          )}
        >
          <Star className={cn(iconSize, value !== null && star <= value && "fill-current")} />
        </button>
      ))}
    </div>
  )
}

function AddWatchlistForm({
  storagePrefix,
  onAdd,
  onCancel,
}: {
  storagePrefix: string
  onAdd: (item: {
    title: string
    media_type: MediaType
    status: WatchStatus
    rating: number | null
    notes: string | null
    tags: string[]
    year: number | null
  }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = usePersistedState(`${storagePrefix}:watchlist:add:title`, "")
  const [mediaType, setMediaType] = usePersistedState<MediaType>(`${storagePrefix}:watchlist:add:type`, "movie")
  const [status, setStatus] = usePersistedState<WatchStatus>(`${storagePrefix}:watchlist:add:status`, "want")
  const [rating, setRating] = usePersistedState<number | null>(`${storagePrefix}:watchlist:add:rating`, null)
  const [notes, setNotes] = usePersistedState(`${storagePrefix}:watchlist:add:notes`, "")
  const [year, setYear] = usePersistedState(`${storagePrefix}:watchlist:add:year`, "")
  const [tagInput, setTagInput] = usePersistedState(`${storagePrefix}:watchlist:add:tagInput`, "")
  const [tags, setTags] = usePersistedState<string[]>(`${storagePrefix}:watchlist:add:tags`, [])
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const resetForm = () => {
    setTitle("")
    setMediaType("movie")
    setStatus("want")
    setRating(null)
    setNotes("")
    setYear("")
    setTagInput("")
    setTags([])
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      media_type: mediaType,
      status,
      rating: status === "watched" ? rating : null,
      notes: notes.trim() || null,
      tags,
      year: year ? Number(year) : null,
    })
    resetForm()
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-border-default p-4 overflow-hidden">
      <TitleAutocompleteInput
        title={title}
        setTitle={setTitle}
        year={year}
        setYear={setYear}
        mediaType={mediaType}
        setMediaType={setMediaType}
        inputRef={titleRef}
        onSubmit={handleSubmit}
      />

      {/* Type toggle */}
      <div className="flex gap-2 mb-3">
        {MEDIA_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type]
          const colors = TYPE_COLORS[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => setMediaType(type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all capitalize",
                mediaType === type
                  ? cn(colors.text, colors.bg, colors.border)
                  : "border-border-default text-text-dim hover:text-text-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {type}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WatchStatus)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {WATCH_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[100px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2024"
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
        </div>
      </div>

      {/* Rating (only when watched) */}
      {status === "watched" && (
        <div className="mb-3">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1.5">Rating</label>
          <StarRating value={rating} onChange={setRating} size="md" />
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      {/* Tags */}
      <div className="mb-3">
        <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Genre, mood…"
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
                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-upper-push-bg text-upper-push border border-upper-push-border cursor-pointer"
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
          className="flex-1 py-2.5 rounded-lg bg-upper-push text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add to Watchlist
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

function EditWatchlistForm({
  item,
  onSave,
  onCancel,
}: {
  item: WatchlistItem
  onSave: (updates: Partial<WatchlistItem>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [mediaType, setMediaType] = useState<MediaType>(item.media_type)
  const [status, setStatus] = useState<WatchStatus>(item.status)
  const [rating, setRating] = useState<number | null>(item.rating)
  const [notes, setNotes] = useState(item.notes ?? "")
  const [year, setYear] = useState(item.year?.toString() ?? "")
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
      media_type: mediaType,
      status,
      rating: status === "watched" ? rating : null,
      notes: notes.trim() || null,
      tags,
      year: year ? Number(year) : null,
    })
  }

  return (
    <div className="rounded-xl bg-bg-secondary border border-upper-push-border p-4 overflow-hidden">
      <TitleAutocompleteInput
        title={title}
        setTitle={setTitle}
        year={year}
        setYear={setYear}
        mediaType={mediaType}
        setMediaType={setMediaType}
        inputRef={titleRef}
        onSubmit={handleSubmit}
      />

      {/* Type toggle */}
      <div className="flex gap-2 mb-3">
        {MEDIA_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type]
          const colors = TYPE_COLORS[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => setMediaType(type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all capitalize",
                mediaType === type
                  ? cn(colors.text, colors.bg, colors.border)
                  : "border-border-default text-text-dim hover:text-text-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {type}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WatchStatus)}
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none appearance-none"
          >
            {WATCH_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[100px]">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2024"
            className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base border border-border-default focus:border-border-hover outline-none"
          />
        </div>
      </div>

      {/* Rating (only when watched) */}
      {status === "watched" && (
        <div className="mb-3">
          <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1.5">Rating</label>
          <StarRating value={rating} onChange={setRating} size="md" />
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full bg-bg-elevated rounded-lg px-3 py-2 text-text-secondary text-base placeholder:text-text-dim outline-none border border-border-default focus:border-border-hover resize-none mb-3"
      />

      {/* Tags */}
      <div className="mb-3">
        <label className="text-text-dim text-[10px] font-mono uppercase tracking-wider block mb-1">Tags</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Genre, mood…"
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
                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-upper-push-bg text-upper-push border border-upper-push-border cursor-pointer"
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
          className="flex-1 py-2.5 rounded-lg bg-upper-push text-bg-primary text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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

function WatchlistCard({
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
  item: WatchlistItem
  onStatusChange: (status: WatchStatus) => void
  onDelete: () => void
  onEdit: () => void
  isEditing: boolean
  onSaveEdit: (updates: Partial<WatchlistItem>) => void
  onCancelEdit: () => void
}) {
  const [expanded, setExpanded] = usePersistedState(`${storagePrefix}:watchlist:item:${item.id}`, false)
  const statusColors = STATUS_COLORS[item.status]
  const typeColors = TYPE_COLORS[item.media_type]
  const TypeIcon = TYPE_ICONS[item.media_type]
  const isWatched = item.status === "watched"

  if (isEditing) {
    return <EditWatchlistForm item={item} onSave={onSaveEdit} onCancel={onCancelEdit} />
  }

  const nextStatus: WatchStatus =
    item.status === "want" ? "watching" :
    item.status === "watching" ? "watched" :
    "want"

  const StatusIcon = item.status === "watched" ? Eye : item.status === "watching" ? Eye : EyeOff

  return (
    <div
      className={cn(
        "rounded-xl bg-bg-secondary border transition-all",
        isWatched ? "border-border-default opacity-60" : "border-border-default"
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
          <StatusIcon className="w-3.5 h-3.5" />
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
                isWatched ? "text-text-dim" : "text-text-primary"
              )}
            >
              {item.title}
              {item.year && (
                <span className="text-text-dim font-normal ml-1.5 text-[12px]">({item.year})</span>
              )}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1",
                  typeColors.text, typeColors.bg
                )}
              >
                <TypeIcon className="w-3 h-3" />
                {item.media_type}
              </span>
            </div>
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("text-[11px] font-mono px-1.5 py-0.5 rounded", statusColors.text, statusColors.bg)}>
              {STATUS_SHORT_LABELS[item.status]}
            </span>
            {isWatched && item.rating !== null && (
              <span className="flex items-center gap-0.5 text-[11px] text-core font-mono">
                <Star className="w-3 h-3 fill-current" />
                {item.rating}/10
              </span>
            )}
            {item.tags.length > 0 && (
              <span className="text-[11px] text-text-dim font-mono">
                {item.tags.slice(0, 2).join(", ")}
                {item.tags.length > 2 && ` +${item.tags.length - 2}`}
              </span>
            )}
            {(item.notes || item.tags.length > 0 || expanded) && (
              <ChevronDown className={cn("w-3 h-3 text-text-dim ml-auto transition-transform", expanded && "rotate-180")} />
            )}
          </div>

          {/* Expanded details */}
          {expanded && (
            <>
              {isWatched && (
                <div className="mt-2">
                  <StarRating value={item.rating} readonly size="sm" />
                </div>
              )}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-upper-push-bg text-upper-push border border-upper-push-border"
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-text-dim text-xs hover:text-upper-push hover:bg-upper-push-bg transition-colors"
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

export function Watchlist() {
  const supabase = useDataClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const queryClient = useQueryClient()

  const storagePrefix = user?.id ?? "guest"
  const [filterMode, setFilterMode] = usePersistedState<FilterMode>(`${storagePrefix}:watchlist:filter`, "all")
  const [typeFilter, setTypeFilter] = usePersistedState<MediaType | "all">(`${storagePrefix}:watchlist:typeFilter`, "all")
  const [excludedTypes, setExcludedTypes] = usePersistedState<Set<string>>(`${storagePrefix}:watchlist:excludedTypes`, new Set())
  const [showAddForm, setShowAddForm] = usePersistedState(`${storagePrefix}:watchlist:showAdd`, false)
  const [editingId, setEditingId] = usePersistedState<string | null>(`${storagePrefix}:watchlist:editingId`, null)

  const itemsQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as WatchlistItem[]
    },
  })

  const items = itemsQuery.data ?? []
  const loading = itemsQuery.isLoading
  const error = itemsQuery.error?.message ?? null
  const refreshing = itemsQuery.isRefetching

  const addMutation = useMutation({
    mutationFn: async (newItem: {
      title: string
      media_type: MediaType
      status: WatchStatus
      rating: number | null
      notes: string | null
      tags: string[]
      year: number | null
    }) => {
      const { error } = await supabase.from("watchlist").insert({
        ...newItem,
        user_id: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] })
      setShowAddForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WatchlistItem> }) => {
      const { error } = await supabase
        .from("watchlist")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  })

  const filteredItems = useMemo(() => {
    let result = items

    if (filterMode !== "all") {
      result = result.filter((i) => i.status === filterMode)
    }
    if (typeFilter !== "all") {
      result = result.filter((i) => i.media_type === typeFilter)
    } else if (excludedTypes.size > 0) {
      result = result.filter((i) => !excludedTypes.has(i.media_type))
    }

    return [...result].sort((a, b) => {
      if (a.status === "watched" && b.status !== "watched") return 1
      if (a.status !== "watched" && b.status === "watched") return -1

      const statusOrder: Record<WatchStatus, number> = { watching: 0, want: 1, watched: 2 }
      const sDiff = statusOrder[a.status] - statusOrder[b.status]
      if (sDiff !== 0) return sDiff

      if (a.status === "watched" && b.status === "watched") {
        const aRating = a.rating ?? 0
        const bRating = b.rating ?? 0
        if (aRating !== bRating) return bRating - aRating
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [items, filterMode, typeFilter, excludedTypes])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length, want: 0, watching: 0, watched: 0 }
    for (const i of items) {
      counts[i.status] = (counts[i.status] ?? 0) + 1
    }
    return counts
  }, [items])

  const handleStatusChange = useCallback((id: string, status: WatchStatus) => {
    updateMutation.mutate({ id, updates: { status } })
  }, [updateMutation])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-upper-push rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading watchlist...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-upper-push-bg border border-upper-push-border rounded-xl p-6 max-w-sm text-center">
          <p className="text-upper-push font-semibold mb-2">Failed to load watchlist</p>
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
              Watchlist
            </h1>
            <span className="text-text-dim text-xs font-mono font-medium">
              {filterMode === "all" && typeFilter === "all"
                ? items.filter((i) => i.status !== "watched").length
                : filteredItems.filter((i) => i.status !== "watched").length}{" "}
              queued
            </span>
          </>
        }
        subtitle="Movies & shows to watch"
        sticky
        rightActions={
          <>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["watchlist"] })}
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
                  ? "text-upper-push bg-upper-push-bg"
                  : "text-text-dim hover:text-upper-push hover:bg-bg-secondary"
              )}
              title={showAddForm ? "Close form" : "Add to watchlist"}
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
          {(["all", "want", "watching", "watched"] as const).map((mode) => (
            <FilterButton
              key={mode}
              label={mode === "all" ? "All" : STATUS_SHORT_LABELS[mode as WatchStatus]}
              count={statusCounts[mode] ?? 0}
              isActive={filterMode === mode}
              style={mode === "all"
                ? { text: "text-upper-push", bg: "bg-upper-push-bg", border: "border-upper-push-border" }
                : STATUS_COLORS[mode as WatchStatus]}
              onSelect={() => setFilterMode(mode)}
            />
          ))}
        </FilterRow>

        {/* Type filter pills */}
        <FilterRow
          className="mt-2"
          canExclude={typeFilter === "all"}
          excludedCount={excludedTypes.size}
          hint="Hold a type to exclude it"
        >
          <FilterButton
            label="All"
            count={items.length - items.filter((i) => excludedTypes.has(i.media_type)).length}
            isActive={typeFilter === "all"}
            size="sm"
            onSelect={() => {
              setTypeFilter("all")
              setExcludedTypes(new Set())
            }}
          />
          {MEDIA_TYPES.map((type) => {
            const colors = TYPE_COLORS[type]
            const Icon = TYPE_ICONS[type]
            const count = items.filter((i) => i.media_type === type).length
            const isExcluded = excludedTypes.has(type)
            if (count === 0 && typeFilter !== type && !isExcluded) return null
            return (
              <FilterButton
                key={type}
                label={type === "movie" ? "Movies" : "Shows"}
                count={count}
                isActive={typeFilter === type}
                isExcluded={isExcluded}
                style={colors}
                icon={Icon}
                size="sm"
                canExclude={typeFilter === "all"}
                onSelect={() => {
                  if (isExcluded) {
                    setExcludedTypes((prev) => {
                      const next = new Set(prev)
                      next.delete(type)
                      return next
                    })
                  } else {
                    setTypeFilter(type)
                    setExcludedTypes(new Set())
                  }
                }}
                onExclude={() => {
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
        </FilterRow>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4 pb-10">
        {showAddForm && (
          <div className="mb-4">
            <AddWatchlistForm
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
            <Clapperboard className="w-12 h-12 text-text-dim mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Nothing on your list
            </h2>
            <p className="text-text-muted text-sm text-center max-w-xs mb-6">
              Keep track of movies and shows you want to watch, are watching, or have watched.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 rounded-lg bg-upper-push text-bg-primary text-sm font-semibold transition-colors"
            >
              Add your first title
            </button>
          </div>
        )}

        {/* Filtered empty state */}
        {items.length > 0 && filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-dim text-sm">No items match this filter.</p>
            <button
              onClick={() => { setFilterMode("all"); setTypeFilter("all") }}
              className="text-upper-push text-sm mt-2 hover:underline"
            >
              Show all items
            </button>
          </div>
        )}

        {/* Item list */}
        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => (
            <WatchlistCard
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

        {/* Watched count footer */}
        {statusCounts.watched > 0 && filterMode !== "watched" && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setFilterMode(filterMode === "all" ? "watched" : "all")}
              className="text-text-dim text-xs font-mono hover:text-text-muted transition-colors"
            >
              {statusCounts.watched} watched {statusCounts.watched === 1 ? "title" : "titles"}
            </button>
          </div>
        )}

        {/* Subtle guide link */}
        <div className="flex justify-center pt-8 pb-4">
          <Link
            to="/instructions/watchlist"
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
