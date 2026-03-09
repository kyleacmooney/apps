import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './context/AuthContext'
import { SupabaseProvider } from './context/SupabaseContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteRestorer } from './components/RouteRestorer'
import { Home } from './pages/Home'
import { Exercises } from './pages/Exercises'
import { Workouts } from './pages/Workouts'
import { Plants } from './pages/Plants'
import { Settings } from './pages/Settings'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <SupabaseProvider>
      <HashRouter>
        <RouteRestorer />
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </SupabaseProvider>
    </AuthProvider>
    </QueryClientProvider>
  )
}
