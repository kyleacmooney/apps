import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth()

  if (loading) {
    return <div className="center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="center">
        <p>Sign in to access this page.</p>
        <button onClick={signIn}>Sign in with Google</button>
      </div>
    )
  }

  return <>{children}</>
}
