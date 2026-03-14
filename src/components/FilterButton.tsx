import { useState, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const LONG_PRESS_MS = 500

export interface FilterButtonStyle {
  text: string
  bg: string
  border: string
}

interface FilterButtonProps {
  label: string
  count: number
  isActive: boolean
  isExcluded?: boolean
  /** Active color style. If null/undefined, uses the default muted active style. */
  style?: FilterButtonStyle | null
  icon?: React.ComponentType<{ className?: string }>
  /** md = px-3 py-1.5 text-xs (primary rows), sm = px-2.5 py-1 text-[11px] (secondary rows) */
  size?: "md" | "sm"
  /** Enable long-press to exclude this filter. Caller should set false for "All" buttons and when not in "all" mode. */
  canExclude?: boolean
  className?: string
  onSelect: () => void
  onExclude?: () => void
}

export function FilterButton({
  label,
  count,
  isActive,
  isExcluded = false,
  style = null,
  icon: Icon,
  size = "md",
  canExclude = false,
  className,
  onSelect,
  onExclude,
}: FilterButtonProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const didLongPress = useRef(false)
  const [pressing, setPressing] = useState(false)
  const [justToggled, setJustToggled] = useState(false)

  function handlePointerDown() {
    didLongPress.current = false
    if (!canExclude) return
    if (!isExcluded) {
      setPressing(true)
    }
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setPressing(false)
      setJustToggled(true)
      setTimeout(() => setJustToggled(false), 400)
      onExclude?.()
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
        "relative shrink-0 rounded-lg border font-semibold cursor-pointer whitespace-nowrap select-none touch-manipulation overflow-hidden",
        "transition-all duration-200",
        size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
        justToggled && "animate-[filter-pop_0.4s_ease-out]",
        isExcluded
          ? "border-upper-push-border/40 bg-upper-push-bg/30 text-text-dim line-through"
          : isActive && style
            ? `${style.border} ${style.bg} ${style.text}`
            : isActive
              ? "border-text-muted/40 bg-text-muted/20 text-text-secondary"
              : "border-border-default bg-transparent text-text-dim hover:text-text-muted",
        className
      )}
    >
      {/* Long-press progress fill */}
      {pressing && (
        <span
          className="absolute inset-0 rounded-lg opacity-20 animate-[filter-fill_0.5s_linear_forwards] origin-left"
          style={{ background: "var(--color-upper-push)" }}
        />
      )}
      <span className="relative flex items-center gap-0.5">
        {isExcluded && <X className="w-3 h-3 inline -ml-0.5" />}
        {Icon && <Icon className="w-3 h-3" />}
        {label}
        <span className="ml-1 opacity-60 font-mono text-[11px]">{count}</span>
      </span>
    </button>
  )
}

interface FilterRowProps {
  children: React.ReactNode
  /** Number of currently excluded items — controls hint text display */
  excludedCount?: number
  /** Whether to show exclude hint text (only meaningful when a row supports exclusion) */
  canExclude?: boolean
  hint?: string
  className?: string
}

export function FilterRow({
  children,
  excludedCount = 0,
  canExclude = false,
  hint = "Hold a filter to exclude it",
  className,
}: FilterRowProps) {
  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 scrollbar-none pb-0.5">
        {children}
      </div>
      {canExclude && excludedCount === 0 && (
        <p className="text-text-dim text-[10px] font-mono mt-1.5 ml-0.5 opacity-60">
          {hint}
        </p>
      )}
      {canExclude && excludedCount > 0 && (
        <p className="text-upper-push/60 text-[10px] font-mono mt-1.5 ml-0.5">
          {excludedCount} excluded — tap to restore
        </p>
      )}
    </div>
  )
}
