import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ROUTE_KEY = 'lastRoute'
const SCROLL_KEY = 'lastScroll'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()
  const hasRestored = useRef(false)

  // Build the full path including search params
  const fullPath = location.pathname + location.search

  // On mount, restore the last saved route
  useEffect(() => {
    const savedRoute = localStorage.getItem(ROUTE_KEY)
    if (!savedRoute || savedRoute === '/' || savedRoute === fullPath) {
      // Already on the right route (or no saved route) — restore scroll directly
      hasRestored.current = true
      restoreScroll()
    } else {
      navigate(savedRoute, { replace: true })
      // hasRestored stays false — scroll will be restored in the fullPath effect below
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigating to the restored route, restore scroll position
  useEffect(() => {
    if (hasRestored.current) return
    // Check if we've arrived at the saved route
    const savedRoute = localStorage.getItem(ROUTE_KEY)
    if (savedRoute && fullPath === savedRoute) {
      hasRestored.current = true
      restoreScroll()
    }
  }, [fullPath])

  // Persist route on every navigation (including search params)
  useEffect(() => {
    if (hasRestored.current) {
      localStorage.setItem(ROUTE_KEY, fullPath)
    }
  }, [fullPath])

  // Persist scroll position periodically and on visibility change
  useEffect(() => {
    const saveScroll = () =>
      localStorage.setItem(SCROLL_KEY, String(window.scrollY))

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        saveScroll()
        ticking = false
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveScroll()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', saveScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', saveScroll)
    }
  }, [])

  return null
}

/** Poll until the page is tall enough to scroll to the saved position, then scroll. */
function restoreScroll() {
  const raw = localStorage.getItem(SCROLL_KEY)
  if (!raw) return
  const y = parseInt(raw, 10)
  if (isNaN(y) || y === 0) return

  let attempts = 0
  const maxAttempts = 50 // 5 seconds
  const interval = setInterval(() => {
    attempts++
    if (document.documentElement.scrollHeight >= y + window.innerHeight || attempts >= maxAttempts) {
      clearInterval(interval)
      window.scrollTo(0, y)
    }
  }, 100)
}
