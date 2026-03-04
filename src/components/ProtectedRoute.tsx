import type { ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import { LogIn } from "lucide-react"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth()

  // In dev mode, skip auth to allow visual testing of protected pages
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-upper-pull rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-5">
        <div className="bg-bg-secondary border border-border-default rounded-xl p-8 max-w-sm text-center">
          <p className="text-text-secondary text-sm mb-4">
            Sign in to access this page.
          </p>
          <button
            onClick={signIn}
            className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm font-medium hover:border-border-hover transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
