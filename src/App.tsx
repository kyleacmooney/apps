import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Exercises } from './pages/Exercises'
import { Workouts } from './pages/Workouts'
import { Plants } from './pages/Plants'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <Exercises />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts"
            element={
              <ProtectedRoute>
                <Workouts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plants"
            element={
              <ProtectedRoute>
                <Plants />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
    </QueryClientProvider>
  )
}
