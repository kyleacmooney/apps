import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { queryClient } from '@/lib/query-client'

interface SupabaseContextValue {
  /** Supabase client for data queries — either the shared backend or user's own project */
  dataClient: SupabaseClient
  /** Whether the user has connected their own Supabase project */
  isExternalBackend: boolean
  /** External Supabase URL if configured */
  externalUrl: string | null
  /** True while fetching user_settings after auth */
  settingsLoading: boolean
   /** How the data client is authenticated (shared-only vs external authed/anon) */
  authMode: 'shared-only' | 'external-authed' | 'external-anon' | 'external-error'
  /** Error message if attempting to auth against the external backend failed */
  externalAuthError: string | null
  /** Save external Supabase configuration */
  saveExternalBackend: (url: string, anonKey: string) => Promise<void>
  /** Remove external Supabase configuration (revert to shared backend) */
  clearExternalBackend: () => Promise<void>
  /**
   * Slugs of apps the user has chosen to install, or null if never customized
   * (null = show all apps, backwards-compatible default).
   */
  installedApps: string[] | null
  /** Persist the user's installed apps list */
  saveInstalledApps: (apps: string[]) => Promise<void>
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const { user, idToken } = useAuth()
  const [externalConfig, setExternalConfig] = useState<{ url: string; key: string } | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'shared-only' | 'external-authed' | 'external-anon' | 'external-error'>('shared-only')
  const [externalAuthError, setExternalAuthError] = useState<string | null>(null)
  const [installedApps, setInstalledApps] = useState<string[] | null>(null)

  // Fetch user_settings when user changes
  useEffect(() => {
    if (!user) {
      setExternalConfig(null)
      setSettingsLoading(false)
      return
    }

    setSettingsLoading(true)
    supabase
      .from('user_settings')
      .select('external_supabase_url, external_supabase_anon_key, installed_apps')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.external_supabase_url && data?.external_supabase_anon_key) {
          setExternalConfig({
            url: data.external_supabase_url,
            key: data.external_supabase_anon_key,
          })
        } else {
          setExternalConfig(null)
        }
        setInstalledApps(Array.isArray(data?.installed_apps) ? (data.installed_apps as string[]) : null)
        setSettingsLoading(false)
      })
  }, [user])

  // Create the data client — memoize to avoid recreating on every render
  const dataClient = useMemo(() => {
    if (externalConfig) {
      return createClient(externalConfig.url, externalConfig.key)
    }
    return supabase
  }, [externalConfig])

  // Clear React Query cache when backend changes so pages refetch from the right source
  const prevClientRef = useMemo(() => ({ current: dataClient }), [])
  useEffect(() => {
    if (prevClientRef.current !== dataClient) {
      prevClientRef.current = dataClient
      queryClient.clear()
    }
  }, [dataClient, prevClientRef])

  // Keep track of how the current data client is authenticated.
  useEffect(() => {
    if (!externalConfig) {
      setAuthMode('shared-only')
      setExternalAuthError(null)
      return
    }

    // Default for external projects is anon-only; a successful signInWithIdToken
    // will promote this to "external-authed".
    setAuthMode((current) =>
      current === 'external-authed' || current === 'external-error' ? current : 'external-anon',
    )
  }, [externalConfig])

  // When we have both an external backend and a Google ID token, attempt to
  // authenticate against the external Supabase project using signInWithIdToken.
  useEffect(() => {
    let cancelled = false

    async function maybeAuthExternal() {
      if (!externalConfig || !idToken) {
        if (!externalConfig) {
          setAuthMode('shared-only')
          setExternalAuthError(null)
        }
        return
      }

      try {
        const { error } = await dataClient.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        })

        if (cancelled) return

        if (error) {
          setAuthMode('external-anon')
          setExternalAuthError(error.message)
        } else {
          setAuthMode('external-authed')
          setExternalAuthError(null)
        }
      } catch (err) {
        if (cancelled) return
        setAuthMode('external-error')
        setExternalAuthError(err instanceof Error ? err.message : 'Failed to authenticate external Supabase project.')
      }
    }

    void maybeAuthExternal()

    return () => {
      cancelled = true
    }
  }, [externalConfig, idToken, dataClient])

  const saveExternalBackend = useCallback(async (url: string, anonKey: string) => {
    if (!user) return

    // Upsert user_settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        external_supabase_url: url,
        external_supabase_anon_key: anonKey,
        setup_completed: true,
      }, { onConflict: 'user_id' })

    if (error) throw error

    setExternalConfig({ url, key: anonKey })
  }, [user])

  const saveInstalledApps = useCallback(async (apps: string[]) => {
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, installed_apps: apps }, { onConflict: 'user_id' })

    if (error) throw error

    setInstalledApps(apps)
  }, [user])

  const clearExternalBackend = useCallback(async () => {
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .update({
        external_supabase_url: null,
        external_supabase_anon_key: null,
        setup_completed: false,
      })
      .eq('user_id', user.id)

    if (error) throw error

    setExternalConfig(null)
  }, [user])

  const value = useMemo<SupabaseContextValue>(() => ({
    dataClient,
    isExternalBackend: !!externalConfig,
    externalUrl: externalConfig?.url ?? null,
    settingsLoading,
    authMode,
    externalAuthError,
    saveExternalBackend,
    clearExternalBackend,
    installedApps,
    saveInstalledApps,
  }), [dataClient, externalConfig, settingsLoading, authMode, externalAuthError, saveExternalBackend, clearExternalBackend, installedApps, saveInstalledApps])

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useDataClient() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useDataClient must be used within SupabaseProvider')
  return ctx.dataClient
}

export function useSupabaseSettings() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useSupabaseSettings must be used within SupabaseProvider')
  return ctx
}
