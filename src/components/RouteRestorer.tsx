import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ROUTE_KEY = 'lastRoute'
const SCROLL_KEY = 'lastScroll'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()
  const restoringRef = useRef(false)

  // Build the full path including search params
  const fullPath = location.pathname + location.search

  // On mount, restore the last saved route
  useEffect(() => {
    const savedRoute = localStorage.getItem(ROUTE_KEY)
    if (savedRoute && savedRoute !== '/' && savedRoute !== fullPath) {
      restoringRef.current = true
      navigate(savedRoute, { replace: true })
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigating to the restored route, restore scroll position
  // Uses polling to wait for content to render (React Query data may load async)
  useEffect(() => {
    if (!restoringRef.current) return
    restoringRef.current = false

    const savedScroll = localStorage.getItem(SCROLL_KEY)
    if (!savedScroll) return
    const y = parseInt(savedScroll, 10)
    if (isNaN(y) || y === 0) return

    // Poll until the document is tall enough to scroll to the saved position,
    // or give up after 3 seconds
    let attempts = 0
    const maxAttempts = 30
    const interval = setInterval(() => {
      attempts++
      if (document.documentElement.scrollHeight >= y + window.innerHeight || attempts >= maxAttempts) {
        clearInterval(interval)
        window.scrollTo(0, y)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [location.pathname])

  // Persist route on every navigation (including search params)
  useEffect(() => {
    localStorage.setItem(ROUTE_KEY, fullPath)
  }, [fullPath])

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
