import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()
  const hasRestored = useRef(false)
  const prevPathname = useRef<string | null>(null)
  const restoreIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const routeKey = getScopedStorageKey('lastRoute')

  const fullPath = location.pathname + location.search
  const hashPathname = location.pathname

  // On mount, restore the last saved route
  useEffect(() => {
    const savedRoute = localStorage.getItem(routeKey)
    if (!savedRoute || savedRoute === '/' || savedRoute === fullPath) {
      hasRestored.current = true
      restoreScroll(scrollKeyForRoute(hashPathname), restoreIntervalRef)
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
      restoreScroll(scrollKeyForRoute(hashPathname), restoreIntervalRef)
    }
  }, [fullPath, hashPathname, routeKey])

  // Persist route on every navigation (including search params)
  useEffect(() => {
    if (hasRestored.current) {
      localStorage.setItem(routeKey, fullPath)
    }
  }, [fullPath, routeKey])

  // Scroll to top when hash pathname changes (after initial restoration)
  useEffect(() => {
    if (!hasRestored.current) return
    // First render after restore — record current pathname, don't scroll
    if (prevPathname.current === null) {
      prevPathname.current = hashPathname
      return
    }
    if (prevPathname.current === hashPathname) return

    // Cancel any in-progress scroll restoration from a previous route
    clearInterval(restoreIntervalRef.current)

    // Save scroll position for the route we're leaving
    localStorage.setItem(scrollKeyForRoute(prevPathname.current), String(window.scrollY))
    prevPathname.current = hashPathname
    window.scrollTo(0, 0)
  }, [hashPathname])

  // Persist scroll position periodically per hash route
  const pathnameRef = useRef(hashPathname)
  pathnameRef.current = hashPathname

  useEffect(() => {
    const saveScroll = () =>
      localStorage.setItem(scrollKeyForRoute(pathnameRef.current), String(window.scrollY))

    let rafPending = false
    const onScroll = () => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        saveScroll()
        rafPending = false
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

/** Reveal the page (body was hidden by inline script in index.html to prevent jump). */
function revealPage() {
  document.body.style.opacity = '1'
}

function getScopedStorageKey(key: string) {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  return `${path}:${key}`
}

/** Per-route scroll key — each hash pathname gets its own saved scroll position. */
function scrollKeyForRoute(hashPathname: string) {
  const base = window.location.pathname.replace(/\/$/, '') || '/'
  return `${base}:scroll:${hashPathname}`
}

/**
 * Poll until the page is tall enough, scroll instantly (hidden behind opacity:0),
 * then fade the page in so the user sees it already in position.
 */
function restoreScroll(
  scrollKey: string,
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | undefined>
) {
  const raw = localStorage.getItem(scrollKey)
  if (!raw) { revealPage(); return }
  const y = parseInt(raw, 10)
  if (isNaN(y) || y === 0) { revealPage(); return }

  let attempts = 0
  const maxAttempts = 50 // 5 seconds max
  intervalRef.current = setInterval(() => {
    attempts++
    if (document.documentElement.scrollHeight >= y + window.innerHeight || attempts >= maxAttempts) {
      clearInterval(intervalRef.current)
      window.scrollTo(0, y)
      // Reveal after a microtask so the browser paints at the new scroll position
      requestAnimationFrame(() => revealPage())
    }
  }, 100)
}
