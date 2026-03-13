import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useSupabaseSettings } from "@/context/SupabaseContext"
import { useCanGoForward } from "@/lib/use-can-go-forward"
import {
  acknowledgeHomeMessage,
  addMessagesChangeListener,
  getHomeMessages,
  getUnreadCount,
  markMessageRead,
} from "@/lib/app-messages"
import { ALL_APPS, ALL_APP_SLUGS } from "@/lib/apps"
import { cn } from "@/lib/utils"
import {
  LogIn,
  LogOut,
  ArrowRight,
  Settings,
  Database,
  Check,
  Bell,
  ChevronRight,
  X,
  Plus,
  LayoutGrid,
  GripVertical,
} from "lucide-react"

export function Home() {
  const { user, signIn, signOut } = useAuth()
  const { isExternalBackend, settingsLoading, authMode, installedApps, saveInstalledApps } = useSupabaseSettings()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const [unreadCount, setUnreadCount] = useState(0)
  const [homeMessages, setHomeMessages] = useState(getHomeMessages())
  const [managing, setManaging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [installingSlug, setInstallingSlug] = useState<string | null>(null)
  const [uninstallingSlug, setUninstallingSlug] = useState<string | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; index: number } | null>(null)
  const isDraggingRef = useRef(false)
  const justDraggedRef = useRef(false)
  const dragIndicesRef = useRef<{ dragged: number | null; over: number | null }>({ dragged: null, over: null })
  const gridRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const updateMessages = () => {
      setUnreadCount(getUnreadCount())
      setHomeMessages(getHomeMessages())
    }
    updateMessages()
    return addMessagesChangeListener(updateMessages)
  }, [])

  // Lock body scroll when in manage mode
  useEffect(() => {
    if (!managing) return
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [managing])

  // Prevent native scroll during active touch drag (must be non-passive)
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if (isDraggingRef.current) e.preventDefault()
    }
    document.addEventListener('touchmove', handler, { passive: false })
    return () => document.removeEventListener('touchmove', handler)
  }, [])

  const backendStatusLabel = isExternalBackend
    ? authMode === 'external-authed' ? 'Connected (Secure)' : authMode === 'external-anon' ? 'Connected (Anon)' : authMode === 'external-error' ? 'Auth error' : 'Connected'
    : 'Using shared backend'

  const dismissFromHome = (id: string) => {
    acknowledgeHomeMessage(id)
    markMessageRead(id)
  }

  // null = never customized → show all apps
  const activeSlugSet = new Set(installedApps ?? ALL_APP_SLUGS)
  const appMap = useMemo(() => new Map(ALL_APPS.map(a => [a.slug, a])), [])
  const visibleApps = useMemo(() => {
    const slugs = installedApps ?? ALL_APP_SLUGS
    return slugs.map(s => appMap.get(s)!).filter(Boolean)
  }, [installedApps, appMap])
  const hiddenApps = ALL_APPS.filter((a) => !activeSlugSet.has(a.slug))

  const getOrderedInstalledApps = useCallback(() => {
    const slugs = installedApps ?? ALL_APP_SLUGS
    return slugs.map(s => appMap.get(s)!).filter(Boolean)
  }, [installedApps, appMap])

  const toggleApp = async (slug: string) => {
    if (!user || saving) return
    
    const isInstalling = !activeSlugSet.has(slug)
    if (isInstalling) {
      setInstallingSlug(slug)
    } else {
      setUninstallingSlug(slug)
    }

    // Small delay for animation
    await new Promise(resolve => setTimeout(resolve, 300))

    const current = installedApps ?? ALL_APP_SLUGS
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug]
    setSaving(true)
    try {
      await saveInstalledApps(next)
    } finally {
      setSaving(false)
      setInstallingSlug(null)
      setUninstallingSlug(null)
    }
  }

  // --- Desktop (HTML5) drag handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!managing) return
    setDraggedIndex(index)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragStartPos.current = null
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIndex === null || draggedIndex === dropIndex || !user || saving) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const orderedApps = getOrderedInstalledApps()
    const newOrder = [...orderedApps]
    const [draggedApp] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(dropIndex, 0, draggedApp)
    setSaving(true)
    try {
      await saveInstalledApps(newOrder.map(a => a.slug))
    } finally {
      setSaving(false)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // --- Touch drag handlers (mobile) ---
  const handleTileTouchStart = (e: React.TouchEvent, index: number) => {
    if (saving) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, index }
  }

  const handleTileTouchMove = useCallback((_e: React.TouchEvent) => {
    if (!touchStartRef.current || saving) return
    const touch = _e.touches[0]

    if (!isDraggingRef.current) {
      const dx = Math.abs(touch.clientX - touchStartRef.current.x)
      const dy = Math.abs(touch.clientY - touchStartRef.current.y)
      if (dx > 8 || dy > 8) {
        isDraggingRef.current = true
        dragIndicesRef.current.dragged = touchStartRef.current.index
        setDraggedIndex(touchStartRef.current.index)
        if (navigator.vibrate) navigator.vibrate(10)
      }
      return
    }

    // Find which tile is under the finger (hide dragged tile briefly for hit-test)
    if (gridRef.current && touchStartRef.current) {
      const draggedEl = gridRef.current.querySelector(
        `[data-tile-index="${touchStartRef.current.index}"]`
      ) as HTMLElement | null
      if (draggedEl) {
        draggedEl.style.pointerEvents = 'none'
        const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
        draggedEl.style.pointerEvents = ''
        const tileEl = el?.closest?.('[data-tile-index]') as HTMLElement | null
        if (tileEl) {
          const idx = parseInt(tileEl.dataset.tileIndex!, 10)
          if (!isNaN(idx)) {
            dragIndicesRef.current.over = idx
            setDragOverIndex(idx)
          }
        }
      }
    }

    // Auto-scroll the content container near edges
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current)
      autoScrollRef.current = null
    }
    const container = contentRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const edgeZone = 50
      if (touch.clientY < rect.top + edgeZone && container.scrollTop > 0) {
        autoScrollRef.current = setInterval(() => container.scrollBy(0, -6), 16)
      } else if (touch.clientY > rect.bottom - edgeZone) {
        autoScrollRef.current = setInterval(() => container.scrollBy(0, 6), 16)
      }
    }
  }, [saving])

  const handleTileTouchEnd = async () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current)
      autoScrollRef.current = null
    }
    const { dragged, over } = dragIndicesRef.current
    if (isDraggingRef.current && dragged !== null && over !== null && dragged !== over && user && !saving) {
      const orderedApps = getOrderedInstalledApps()
      const newOrder = [...orderedApps]
      const [draggedApp] = newOrder.splice(dragged, 1)
      newOrder.splice(over, 0, draggedApp)
      setSaving(true)
      try {
        await saveInstalledApps(newOrder.map(a => a.slug))
      } finally {
        setSaving(false)
      }
    }
    if (isDraggingRef.current) {
      justDraggedRef.current = true
      setTimeout(() => { justDraggedRef.current = false }, 200)
    }
    isDraggingRef.current = false
    touchStartRef.current = null
    dragIndicesRef.current = { dragged: null, over: null }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className={cn(
      "bg-bg-primary flex flex-col",
      managing ? "h-[100dvh] overflow-hidden" : "min-h-screen"
    )}>
      {/* Auth bar */}
      <div className="flex items-center justify-end gap-3 p-4 flex-wrap">
        <Link
          to="/messages"
          className="relative flex items-center justify-center w-10 h-10 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
          title="Messages"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-upper-pull text-bg-primary text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </Link>
        {user && !settingsLoading && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md",
              isExternalBackend
                ? "bg-lower-bg/50 text-lower border border-lower-border"
                : "bg-bg-elevated text-text-muted border border-border-default"
            )}
            title={isExternalBackend ? "Using your Supabase project" : "Using the shared backend — you're already connected"}
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            {isExternalBackend ? "Your backend" : "Connected"}
          </span>
        )}
        {user ? (
          <>
            <span className="text-text-muted text-sm font-mono truncate max-w-48">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={signIn}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-secondary border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        )}
        {canGoForward && (
          <button
            onClick={() => navigate(1)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center content */}
      <div
        ref={contentRef}
        className={cn(
          "flex-1 flex flex-col items-center px-5",
          managing
            ? "overflow-y-auto overscroll-none pt-2 pb-6 justify-start"
            : "justify-center pb-20"
        )}
      >
        <div className="w-full max-w-md flex items-end justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Apps
            </h1>
            <p className="text-text-muted text-sm">Personal tools</p>
          </div>
          {user && (
            <button
              onClick={() => setManaging((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                managing
                  ? "bg-bg-elevated border border-border-hover text-text-primary"
                  : "text-text-dim hover:text-text-muted"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {managing ? "Done" : "Manage"}
            </button>
          )}
        </div>

        {/* Home surfaced messages */}
        {homeMessages.length > 0 && (
          <div className="w-full max-w-md mb-4">
            {homeMessages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-xl border border-upper-pull-border bg-upper-pull-bg/30 p-4 relative"
              >
                <button
                  onClick={() => dismissFromHome(msg.id)}
                  className="absolute top-3 right-3 text-text-dim hover:text-text-muted transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-semibold text-text-primary pr-6 mb-1.5">
                  {msg.title}
                </h3>
                <p className="text-xs leading-relaxed text-text-secondary mb-3">
                  {msg.content}
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/messages"
                    className="px-3 py-1.5 rounded-lg bg-upper-pull text-bg-primary text-xs font-semibold hover:brightness-110 transition-all no-underline"
                  >
                    View all
                  </Link>
                  <button
                    onClick={() => dismissFromHome(msg.id)}
                    className="px-3 py-1.5 rounded-lg border border-upper-pull-border text-upper-pull text-xs font-semibold hover:bg-upper-pull-bg/50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* App grid — 2 columns */}
        {managing ? (
          <>
            {/* Installed apps — draggable to reorder */}
            <div
              ref={gridRef}
              className="grid grid-cols-2 gap-3 w-full max-w-md"
              style={{ touchAction: 'none' }}
            >
              {getOrderedInstalledApps().map((app, index) => {
                const Icon = app.icon
                const isDragged = draggedIndex === index
                const isDragOver = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                const isInstalling = installingSlug === app.slug
                const isUninstalling = uninstallingSlug === app.slug

                return (
                  <div
                    key={app.slug}
                    data-tile-index={index}
                    draggable={!saving}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    onTouchStart={(e) => handleTileTouchStart(e, index)}
                    onTouchMove={handleTileTouchMove}
                    onTouchEnd={handleTileTouchEnd}
                    onTouchCancel={handleTileTouchEnd}
                    className={cn(
                      "relative transition-all duration-200",
                      isDragged && "opacity-40 scale-90 z-50",
                      isDragOver && "ring-2 ring-upper-pull/60 ring-offset-2 ring-offset-bg-primary rounded-xl scale-[1.03]",
                      (isInstalling || isUninstalling) && "pointer-events-none"
                    )}
                  >
                    <button
                      onClick={() => !saving && !isDraggingRef.current && !justDraggedRef.current && toggleApp(app.slug)}
                      disabled={saving || isInstalling || isUninstalling}
                      className={cn(
                        "group relative flex flex-col items-center justify-center p-5 rounded-xl border aspect-square cursor-pointer w-full",
                        "transition-all duration-300 ease-spring",
                        "bg-bg-secondary border-border-default",
                        isInstalling && "animate-install",
                        isUninstalling && "animate-uninstall"
                      )}
                    >
                      <div className="absolute top-1.5 left-1.5 opacity-60 pointer-events-none">
                        <GripVertical className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                      <Icon className={cn(
                        "w-9 h-9 mb-2.5 transition-all duration-300",
                        app.iconColor,
                        isInstalling && "animate-pulse scale-110",
                        isUninstalling && "scale-75 opacity-0"
                      )} />
                      <span className="text-sm font-semibold text-text-primary text-center">
                        {app.name}
                      </span>
                      <span className="text-text-muted text-[11px] text-center mt-0.5">
                        {app.description}
                      </span>
                      <span className={cn(
                        "absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-300 ease-spring",
                        "bg-bg-elevated border-border-default text-text-muted",
                        isUninstalling && "scale-75 opacity-0"
                      )}>
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Available (uninstalled) apps */}
            {hiddenApps.length > 0 && (
              <>
                <p className="text-text-dim text-[11px] mt-4 mb-2 w-full max-w-md px-1">
                  Available
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                  {hiddenApps.map((app) => {
                    const Icon = app.icon
                    const isInstalling = installingSlug === app.slug

                    return (
                      <div
                        key={app.slug}
                        className={cn(
                          "relative transition-all duration-300",
                          isInstalling && "pointer-events-none"
                        )}
                      >
                        <button
                          onClick={() => !saving && toggleApp(app.slug)}
                          disabled={saving || isInstalling}
                          className={cn(
                            "group relative flex flex-col items-center justify-center p-5 rounded-xl border-dashed border border-border-default aspect-square cursor-pointer w-full",
                            "transition-all duration-300 ease-spring bg-bg-primary",
                            isInstalling && "animate-install"
                          )}
                        >
                          <Icon className={cn(
                            "w-9 h-9 mb-2.5 grayscale opacity-60 transition-all duration-300",
                            app.iconColor,
                            isInstalling && "animate-pulse grayscale-0 opacity-100 scale-110"
                          )} />
                          <span className="text-sm font-semibold text-text-primary text-center">
                            {app.name}
                          </span>
                          <span className="text-text-muted text-[11px] text-center mt-0.5">
                            {app.description}
                          </span>
                          <span className={cn(
                            "absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full border-dashed border border-border-default text-text-dim bg-bg-secondary transition-all duration-300",
                            isInstalling && "scale-110 animate-pulse"
                          )}>
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {visibleApps.map((app) => {
              const Icon = app.icon
              return (
                <Link
                  key={app.slug}
                  to={app.path}
                  className={cn(
                    "group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default transition-all duration-300 ease-spring no-underline aspect-square",
                    "hover:scale-105 active:scale-95",
                    app.hoverBorderColor
                  )}
                >
                  <Icon className={cn("w-9 h-9 mb-2.5 group-hover:scale-110 transition-transform duration-300", app.iconColor)} />
                  <h2 className="text-sm font-semibold text-text-primary text-center">
                    {app.name}
                  </h2>
                  <p className="text-text-muted text-[11px] text-center mt-0.5">
                    {app.description}
                  </p>
                </Link>
              )
            })}
          </div>
        )}

        {/* Utility row — visually distinct from app grid */}
        {user && (
          <div className="w-full max-w-md mt-4 flex flex-col gap-2">
            {!settingsLoading && !isExternalBackend && (
              <Link
                to="/setup"
                className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-primary border border-dashed border-border-default hover:border-lower-border hover:bg-lower-bg/30 transition-all duration-200 no-underline"
              >
                <Database className="w-5 h-5 text-lower shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    Set up your own backend
                  </span>
                  <span className="block text-[11px] text-text-dim mt-0.5">
                    {backendStatusLabel}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-dim shrink-0" />
              </Link>
            )}
            {isExternalBackend && (
              <Link
                to="/setup"
                className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-primary border border-lower-border/50 hover:border-lower-border hover:bg-lower-bg/30 transition-all duration-200 no-underline"
              >
                <Database className="w-5 h-5 text-lower shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    Your backend
                  </span>
                  <span className="block text-[11px] text-lower mt-0.5">
                    {backendStatusLabel}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-dim shrink-0" />
              </Link>
            )}
            <Link
              to="/settings"
              className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-primary border border-border-default hover:border-border-hover transition-all duration-200 no-underline"
            >
              <Settings className="w-5 h-5 text-text-muted shrink-0" />
              <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors flex-1">
                Settings
              </span>
              <ChevronRight className="w-4 h-4 text-text-dim shrink-0" />
            </Link>
          </div>
        )}

        {/* Manage hint when apps have been hidden */}
        {!managing && hiddenApps.length > 0 && user && (
          <p className="text-text-dim text-[11px] mt-4 text-center">
            {hiddenApps.length} app{hiddenApps.length > 1 ? 's' : ''} hidden —{' '}
            <button
              onClick={() => setManaging(true)}
              className="underline cursor-pointer hover:text-text-muted transition-colors"
            >
              Manage
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
