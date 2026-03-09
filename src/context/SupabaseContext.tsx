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
  /** Save external Supabase configuration */
  saveExternalBackend: (url: string, anonKey: string) => Promise<void>
  /** Remove external Supabase configuration (revert to shared backend) */
  clearExternalBackend: () => Promise<void>
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [externalConfig, setExternalConfig] = useState<{ url: string; key: string } | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

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
      .select('external_supabase_url, external_supabase_anon_key')
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
    saveExternalBackend,
    clearExternalBackend,
  }), [dataClient, externalConfig, settingsLoading, saveExternalBackend, clearExternalBackend])

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
