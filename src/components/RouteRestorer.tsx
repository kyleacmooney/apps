import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'lastRoute'

export function RouteRestorer() {
  const location = useLocation()
  const navigate = useNavigate()

  // On mount, restore the last saved route
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved !== '/' && saved !== location.pathname) {
      navigate(saved, { replace: true })
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist route on every navigation
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, location.pathname)
  }, [location.pathname])

  return null
}
