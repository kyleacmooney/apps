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
import { Setup } from './pages/Setup'
import { Chat } from './pages/Chat'
import { Todos } from './pages/Todos'

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
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <Setup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/todos"
            element={
              <ProtectedRoute>
                <Todos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
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
