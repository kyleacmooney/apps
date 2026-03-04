import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Home() {
  const { user, signIn, signOut } = useAuth()

  return (
    <div className="page">
      <h1>Apps</h1>
      <nav>
        <Link to="/workouts">Workouts</Link>
      </nav>
      <div className="auth-status">
        {user ? (
          <>
            <span>Signed in as {user.email}</span>
            <button onClick={signOut}>Sign out</button>
          </>
        ) : (
          <button onClick={signIn}>Sign in with Google</button>
        )}
      </div>
    </div>
  )
}
