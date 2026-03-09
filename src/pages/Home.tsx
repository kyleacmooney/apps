import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useSupabaseSettings } from "@/context/SupabaseContext"
import { useCanGoForward } from "@/lib/use-can-go-forward"
import { usePersistedState } from "@/lib/use-persisted-state"
import { Dumbbell, BookOpen, LogIn, LogOut, ArrowRight, Sprout, Settings, Database, X } from "lucide-react"

export function Home() {
  const { user, signIn, signOut } = useAuth()
  const { isExternalBackend, settingsLoading } = useSupabaseSettings()
  const welcomeKey = user ? `home-welcome-dismissed:${user.id}` : 'home-welcome-dismissed:guest'
  const [welcomeDismissed, setWelcomeDismissed] = usePersistedState(welcomeKey, false)
  const navigate = useNavigate()
  const canGoForward = useCanGoForward()
  const showSetupCard = user && !settingsLoading && !isExternalBackend

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Auth bar */}
      <div className="flex items-center justify-end gap-3 p-4">
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

        {/* Welcome banner (new users) */}
        {user && !welcomeDismissed && (
          <div className="w-full max-w-md mb-6 rounded-xl border border-upper-pull-border bg-upper-pull-bg/30 px-4 py-3 relative">
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              className="absolute top-2 right-2 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-text-primary text-sm pr-6">
              Use Claude with the Supabase MCP connector to log workouts, add plants, and manage data by conversation. Set up your own backend for full data ownership, or use the shared one to try the app.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
          {showSetupCard && (
            <Link
              to="/setup"
              className="group block p-6 rounded-xl bg-lower-bg/50 border-2 border-dashed border-lower-border hover:border-lower hover:bg-lower-bg/70 transition-all duration-200 no-underline"
            >
              <Database className="w-8 h-8 text-lower mb-3 group-hover:scale-110 transition-transform" />
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Set up your backend
              </h2>
              <p className="text-text-muted text-sm">
                Use your own Supabase project & connect Claude via MCP
              </p>
            </Link>
          )}
          <Link
            to="/exercises"
            className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-upper-pull-border transition-all duration-200 no-underline"
          >
            <BookOpen className="w-8 h-8 text-upper-pull mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Exercises
            </h2>
            <p className="text-text-muted text-sm">
              Form cues, progressions & notes
            </p>
          </Link>

          <Link
            to="/workouts"
            className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-cardio-border transition-all duration-200 no-underline"
          >
            <Dumbbell className="w-8 h-8 text-cardio mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Workouts
            </h2>
            <p className="text-text-muted text-sm">
              Session history & logging
            </p>
          </Link>

          <Link
            to="/plants"
            className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-plant-border transition-all duration-200 no-underline"
          >
            <Sprout className="w-8 h-8 text-plant mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Plants
            </h2>
            <p className="text-text-muted text-sm">
              Care schedules & tracking
            </p>
          </Link>

          {user && (
            <Link
              to="/settings"
              className="group block p-6 rounded-xl bg-bg-secondary border border-border-default hover:border-border-hover transition-all duration-200 no-underline"
            >
              <Settings className="w-8 h-8 text-text-muted mb-3 group-hover:scale-110 transition-transform" />
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Settings
              </h2>
              <p className="text-text-muted text-sm">
                Backend & configuration
              </p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
