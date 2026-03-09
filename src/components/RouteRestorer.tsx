import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ROUTE_KEY = 'lastRoute'
const SCROLL_KEY = 'lastScroll'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()
  const restoringRef = useRef(false)

  // On mount, restore the last saved route
  useEffect(() => {
    const savedRoute = localStorage.getItem(ROUTE_KEY)
    if (savedRoute && savedRoute !== '/' && savedRoute !== location.pathname) {
      restoringRef.current = true
      navigate(savedRoute, { replace: true })
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigating to the restored route, restore scroll position
  useEffect(() => {
    if (!restoringRef.current) return
    restoringRef.current = false

    const savedScroll = localStorage.getItem(SCROLL_KEY)
    if (!savedScroll) return
    const y = parseInt(savedScroll, 10)
    if (isNaN(y)) return

    // Wait for React Query data to render before scrolling
    const raf = requestAnimationFrame(() => {
      const timeout = setTimeout(() => window.scrollTo(0, y), 100)
      return () => clearTimeout(timeout)
    })
    return () => cancelAnimationFrame(raf)
  }, [location.pathname])

  // Persist route on every navigation
  useEffect(() => {
    localStorage.setItem(ROUTE_KEY, location.pathname)
  }, [location.pathname])

  // Persist scroll position periodically and on visibility change
  useEffect(() => {
    const saveScroll = () =>
      localStorage.setItem(SCROLL_KEY, String(window.scrollY))

    // Throttled scroll handler
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        saveScroll()
        ticking = false
      })
    }

    // Save when app is about to be suspended (iOS fires this before eviction)
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
