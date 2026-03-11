import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()
  const hasRestored = useRef(false)
  const routeKey = getScopedStorageKey('lastRoute')
  const scrollKey = getScopedStorageKey('lastScroll')

  // Build the full path including search params
  const fullPath = location.pathname + location.search

  // On mount, restore the last saved route
  useEffect(() => {
    const savedRoute = localStorage.getItem(routeKey)
    if (!savedRoute || savedRoute === '/' || savedRoute === fullPath) {
      hasRestored.current = true
      restoreScroll(scrollKey)
    } else {
      navigate(savedRoute, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigating to the restored route, restore scroll position
  useEffect(() => {
    if (hasRestored.current) return
    const savedRoute = localStorage.getItem(routeKey)
    if (savedRoute && fullPath === savedRoute) {
      hasRestored.current = true
      restoreScroll(scrollKey)
    }
  }, [fullPath, routeKey, scrollKey])

  // Persist route on every navigation (including search params)
  useEffect(() => {
    if (hasRestored.current) {
      localStorage.setItem(routeKey, fullPath)
    }
  }, [fullPath, routeKey])

  // Persist scroll position periodically and on visibility change
  useEffect(() => {
    const saveScroll = () =>
      localStorage.setItem(scrollKey, String(window.scrollY))

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
  }, [scrollKey])

  return null
}

/** Reveal the page (body was hidden by inline script in index.html to prevent jump). */
function revealPage() {
  document.body.style.opacity = '1'
}

function getScopedStorageKey(key: string) {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  return `${path}:${key}`
}

/**
 * Poll until the page is tall enough, scroll instantly (hidden behind opacity:0),
 * then fade the page in so the user sees it already in position.
 */
function restoreScroll(scrollKey: string) {
  const raw = localStorage.getItem(scrollKey)
  if (!raw) { revealPage(); return }
  const y = parseInt(raw, 10)
  if (isNaN(y) || y === 0) { revealPage(); return }

  let attempts = 0
  const maxAttempts = 50 // 5 seconds max
  const interval = setInterval(() => {
    attempts++
    if (document.documentElement.scrollHeight >= y + window.innerHeight || attempts >= maxAttempts) {
      clearInterval(interval)
      window.scrollTo(0, y)
      // Reveal after a microtask so the browser paints at the new scroll position
      requestAnimationFrame(() => revealPage())
    }
  }, 100)
}
