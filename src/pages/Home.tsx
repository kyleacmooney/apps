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
import { cn } from "@/lib/utils"
import {
  Dumbbell,
  BookOpen,
  LogIn,
  LogOut,
  ArrowRight,
  Sprout,
  Settings,
  Database,
  Check,
  Sparkles,
  ListTodo,
  Bell,
  ChevronRight,
  X,
} from "lucide-react"

export function Home() {
  const { user, signIn, signOut } = useAuth()
  const { isExternalBackend, settingsLoading, authMode } = useSupabaseSettings()
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const [unreadCount, setUnreadCount] = useState(0)
  const [homeMessages, setHomeMessages] = useState(getHomeMessages())

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
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">
          Apps
        </h1>
        <p className="text-text-muted text-sm mb-6">Personal tools</p>

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
          <Link
            to="/exercises"
            className="group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default hover:border-upper-pull-border transition-all duration-200 no-underline aspect-square"
          >
            <BookOpen className="w-9 h-9 text-upper-pull mb-2.5 group-hover:scale-110 transition-transform" />
            <h2 className="text-sm font-semibold text-text-primary text-center">
              Exercises
            </h2>
            <p className="text-text-muted text-[11px] text-center mt-0.5">
              Form & progressions
            </p>
          </Link>

          <Link
            to="/workouts"
            className="group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default hover:border-cardio-border transition-all duration-200 no-underline aspect-square"
          >
            <Dumbbell className="w-9 h-9 text-cardio mb-2.5 group-hover:scale-110 transition-transform" />
            <h2 className="text-sm font-semibold text-text-primary text-center">
              Workouts
            </h2>
            <p className="text-text-muted text-[11px] text-center mt-0.5">
              Session history
            </p>
          </Link>

          <Link
            to="/plants"
            className="group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default hover:border-plant-border transition-all duration-200 no-underline aspect-square"
          >
            <Sprout className="w-9 h-9 text-plant mb-2.5 group-hover:scale-110 transition-transform" />
            <h2 className="text-sm font-semibold text-text-primary text-center">
              Plants
            </h2>
            <p className="text-text-muted text-[11px] text-center mt-0.5">
              Care & tracking
            </p>
          </Link>

          <Link
            to="/todos"
            className="group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default hover:border-ai-border transition-all duration-200 no-underline aspect-square"
          >
            <ListTodo className="w-9 h-9 text-ai mb-2.5 group-hover:scale-110 transition-transform" />
            <h2 className="text-sm font-semibold text-text-primary text-center">
              Todos
            </h2>
            <p className="text-text-muted text-[11px] text-center mt-0.5">
              Daily tasks
            </p>
          </Link>

          <Link
            to="/chat"
            className="group flex flex-col items-center justify-center p-5 rounded-xl bg-bg-secondary border border-border-default hover:border-ai-border transition-all duration-200 no-underline aspect-square"
          >
            <Sparkles className="w-9 h-9 text-ai mb-2.5 group-hover:scale-110 transition-transform" />
            <h2 className="text-sm font-semibold text-text-primary text-center">
              AI Chat
            </h2>
            <p className="text-text-muted text-[11px] text-center mt-0.5">
              Ask anything
            </p>
          </Link>
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
      </div>
    </div>
  )
}
