import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Dumbbell, BookOpen, LogIn, LogOut } from "lucide-react"

export function Home() {
  const { user, signIn, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Auth bar */}
      <div className="flex justify-end p-4">
        {user ? (
          <div className="flex items-center gap-3">
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
          </div>
        ) : (
          <button
            onClick={signIn}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-secondary border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        )}
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">
          Apps
        </h1>
        <p className="text-text-muted text-sm mb-10">Personal tools</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
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
        </div>
      </div>
    </div>
  )
}
