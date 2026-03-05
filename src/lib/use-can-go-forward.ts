import { useEffect, useState } from "react"
import { useLocation, useNavigationType } from "react-router-dom"

let maxHistoryIdx = 0

export function useCanGoForward() {
  const navigationType = useNavigationType()
  const location = useLocation()
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    const idx = window.history.state?.idx ?? 0

    if (navigationType === "PUSH") {
      // PUSH — this is the new tip, no forward history
      maxHistoryIdx = idx
    } else {
      // POP or REPLACE — forward entries may still exist
      maxHistoryIdx = Math.max(maxHistoryIdx, idx)
    }

    setCanGoForward(idx < maxHistoryIdx)
  }, [location.key, navigationType])

  return canGoForward
}
