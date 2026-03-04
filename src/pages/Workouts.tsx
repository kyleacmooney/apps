import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Exercise {
  id: string
  name: string
  category: string
  current_working: string | null
}

interface WorkoutSession {
  id: string
  date: string
  title: string | null
  session_type: string
  energy_level: number | null
  notes: string | null
}

export function Workouts() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const [exerciseRes, sessionRes] = await Promise.all([
        supabase
          .from('exercises')
          .select('id, name, category, current_working')
          .order('category')
          .order('name'),
        supabase
          .from('workout_sessions')
          .select('id, date, title, session_type, energy_level, notes')
          .order('date', { ascending: false })
          .limit(10),
      ])

      if (exerciseRes.error) {
        setError(exerciseRes.error.message)
      } else {
        setExercises(exerciseRes.data)
      }

      if (sessionRes.error && sessionRes.error.code !== 'PGRST116') {
        setError(prev => prev ? `${prev}; ${sessionRes.error.message}` : sessionRes.error.message)
      } else if (sessionRes.data) {
        setSessions(sessionRes.data)
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="center">Loading...</div>
  if (error) return <div className="center error">Error: {error}</div>

  return (
    <div className="page">
      <nav className="breadcrumbs">
        <Link to="/">Home</Link> / Workouts
      </nav>

      <h1>Workouts</h1>

      <section>
        <h2>Exercises ({exercises.length})</h2>
        {exercises.length === 0 ? (
          <p>No exercises found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Current Working</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map(ex => (
                <tr key={ex.id}>
                  <td>{ex.name}</td>
                  <td>{ex.category}</td>
                  <td>{ex.current_working ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Recent Sessions ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p>No sessions logged yet.</p>
        ) : (
          <ul>
            {sessions.map(s => (
              <li key={s.id}>
                <strong>{s.date}</strong> — {s.title ?? s.session_type}
                {s.energy_level != null && <span> (energy: {s.energy_level}/10)</span>}
                {s.notes && <p>{s.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
