import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './context/AuthContext'
import { SupabaseProvider } from './context/SupabaseContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RouteRestorer } from './components/RouteRestorer'
import { SWUpdatePrompt } from './components/SWUpdatePrompt'
import { Home } from './pages/Home'

const Exercises = lazy(() => import('./pages/Exercises').then((m) => ({ default: m.Exercises })))
const Workouts = lazy(() => import('./pages/Workouts').then((m) => ({ default: m.Workouts })))
const Plants = lazy(() => import('./pages/Plants').then((m) => ({ default: m.Plants })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Setup = lazy(() => import('./pages/Setup').then((m) => ({ default: m.Setup })))
const Chat = lazy(() => import('./pages/Chat').then((m) => ({ default: m.Chat })))
const Todos = lazy(() => import('./pages/Todos').then((m) => ({ default: m.Todos })))
const Messages = lazy(() => import('./pages/Messages').then((m) => ({ default: m.Messages })))
const Instructions = lazy(() => import('./pages/Instructions').then((m) => ({ default: m.Instructions })))
const Interests = lazy(() => import('./pages/Interests').then((m) => ({ default: m.Interests })))
const Watchlist = lazy(() => import('./pages/Watchlist').then((m) => ({ default: m.Watchlist })))

function PageLoader() {
  return <div className="min-h-screen bg-bg-primary" />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <SupabaseProvider>
      <HashRouter>
        <RouteRestorer />
        <SWUpdatePrompt />
        <Suspense fallback={<PageLoader />}>
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
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interests"
              element={
                <ProtectedRoute>
                  <Interests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlist"
              element={
                <ProtectedRoute>
                  <Watchlist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructions/:guide"
              element={
                <ProtectedRoute>
                  <Instructions />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </HashRouter>
    </SupabaseProvider>
    </AuthProvider>
    </QueryClientProvider>
  )
}
