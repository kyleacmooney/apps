import { useState, useEffect, useCallback, useRef } from 'react'

function serialize(value: unknown): string {
  if (value instanceof Set) return JSON.stringify({ __set: [...value] })
  return JSON.stringify(value)
}

function deserialize<T>(raw: string, _defaultValue: T): T {
  const parsed = JSON.parse(raw)
  if (parsed && typeof parsed === 'object' && '__set' in parsed && Array.isArray(parsed.__set)) {
    return new Set(parsed.__set) as T
  }
  return parsed as T
}

/**
 * Like useState, but persists the value to localStorage so it survives
 * iOS standalone-app evictions and page reloads.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const prefixedKey = `ps:${key}`

  const [value, setValueRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(prefixedKey)
      return stored !== null ? deserialize<T>(stored, defaultValue) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem(prefixedKey, serialize(value))
    } catch {
      // Storage full or unavailable
    }
  }, [prefixedKey, value])

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => setValueRaw(action),
    []
  )

  return [value, setValue]
}
