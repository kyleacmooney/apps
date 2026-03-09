import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'

declare global {
  interface Window {
    google?: any
  }
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** Last Google ID token used for sign-in, if available */
  idToken: string | null
}

const generateNonce = async (): Promise<string[]> => {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encoder = new TextEncoder()
  const encodedNonce = encoder.encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return [nonce, hashedNonce]
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [idToken, setIdToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session) {
        setIdToken(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Silently re-obtain the Google ID token for returning users so
  // SupabaseContext can authenticate against external backends.
  useEffect(() => {
    if (!session || idToken || !GOOGLE_CLIENT_ID) return

    let cancelled = false

    async function reObtainToken() {
      try {
        const google = await loadGoogleIdentityScript()
        if (!google?.accounts?.id || cancelled) return

        const [, hashedNonce] = await generateNonce()

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          auto_select: true,
          nonce: hashedNonce,
          callback: (response: { credential?: string }) => {
            if (cancelled) return
            if (response.credential) {
              setIdToken(response.credential)
            }
          },
        })

        google.accounts.id.prompt()
      } catch {
        // GIS unavailable — silently degrade to anon-only for external backends.
      }
    }

    void reObtainToken()

    return () => {
      cancelled = true
    }
  }, [session, idToken])

  async function loadGoogleIdentityScript() {
    if (window.google) return window.google

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script')))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
      document.head.appendChild(script)
    })

    return window.google
  }

  const signIn = async () => {
    // Fallback to Supabase's OAuth flow if a Google client ID is not configured.
    if (!GOOGLE_CLIENT_ID) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      })
      return
    }

    const google = await loadGoogleIdentityScript()

    if (!google?.accounts?.id) {
      throw new Error('Google Identity Services not available in this browser.')
    }

    const [nonce, hashedNonce] = await generateNonce()

    await new Promise<void>((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        nonce: hashedNonce,
        callback: async (response: { credential?: string }) => {
          try {
            const token = response.credential
            if (!token) {
              reject(new Error('No ID token returned from Google.'))
              return
            }

            setIdToken(token)

            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token,
              nonce,
            })

            if (error) {
              reject(error)
              return
            }

            resolve()
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Failed to sign in with Google.'))
          }
        },
      })

      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          reject(new Error('Google sign-in was cancelled or could not be displayed.'))
        }
      })
    })
  }

  const signOut = async () => {
    queryClient.clear()
    await supabase.auth.signOut()
    setIdToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, idToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
