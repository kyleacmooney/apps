import { useEffect, useState } from "react"
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

  useEffect(() => {
    const updateMessages = () => {
      setUnreadCount(getUnreadCount())
      setHomeMessages(getHomeMessages())
    }
    updateMessages()
    return addMessagesChangeListener(updateMessages)
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
  const visibleApps = ALL_APPS.filter((a) => activeSlugSet.has(a.slug))
  const hiddenApps = ALL_APPS.filter((a) => !activeSlugSet.has(a.slug))

  const toggleApp = async (slug: string) => {
    if (!user) return
    const current = installedApps ?? ALL_APP_SLUGS
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug]
    // Preserve original order
    const ordered = ALL_APP_SLUGS.filter((s) => next.includes(s))
    setSaving(true)
    try {
      await saveInstalledApps(ordered)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
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
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-20">
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
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {(managing ? ALL_APPS : visibleApps).map((app) => {
            const Icon = app.icon
            const isInstalled = activeSlugSet.has(app.slug)

            if (managing) {
              return (
                <button
                  key={app.slug}
                  onClick={() => toggleApp(app.slug)}
                  disabled={saving}
                  className={cn(
                    "group relative flex flex-col items-center justify-center p-5 rounded-xl border transition-all duration-200 aspect-square cursor-pointer",
                    isInstalled
                      ? "bg-bg-secondary border-border-default opacity-100"
                      : "bg-bg-primary border-dashed border-border-default opacity-50"
                  )}
                >
                  <Icon className={cn("w-9 h-9 mb-2.5", app.iconColor, !isInstalled && "grayscale")} />
                  <span className="text-sm font-semibold text-text-primary text-center">
                    {app.name}
                  </span>
                  <span className="text-text-muted text-[11px] text-center mt-0.5">
                    {app.description}
                  </span>
                  <span
                    className={cn(
                      "absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full border text-[10px]",
                      isInstalled
                        ? "bg-bg-elevated border-border-default text-text-muted"
                        : "bg-bg-secondary border-dashed border-border-default text-text-dim"
                    )}
                  >
                    {isInstalled ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={app.slug}
                to={app.path}
                className={cn(
                  "group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default transition-all duration-200 no-underline aspect-square",
                  app.hoverBorderColor
                )}
              >
                <Icon className={cn("w-9 h-9 mb-2.5 group-hover:scale-110 transition-transform", app.iconColor)} />
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
