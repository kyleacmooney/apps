import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/context/AuthContext'
import { useSupabaseSettings, useDataClient } from '@/context/SupabaseContext'
import {
  getToken, hasStoredToken, saveToken, clearToken, migrateToken, invalidateCache,
  getTokenStorageMode, setTokenStorageMode, PRIVATE_TABLE_SQL,
  type TokenStorageMode,
} from '@/lib/token-storage'
import { isAppOwner } from '@/lib/app-owner'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import { ArrowLeft, Database, ExternalLink, Loader2, Check, X, Unplug, Home, ShieldCheck, ShieldAlert, Lock, Sparkles, Eye, EyeOff, Trash2, Monitor, Cloud, HardDrive, Shield, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    isExternalBackend,
    externalUrl,
    settingsLoading,
    authMode,
    externalAuthError,
    saveExternalBackend,
    clearExternalBackend,
  } = useSupabaseSettings()

  const ownerOnShared = !isExternalBackend && !!user && isAppOwner(user.email)
  const [url, setUrl] = useState(externalUrl ?? (ownerOnShared ? SUPABASE_URL : ''))
  const [anonKey, setAnonKey] = useState(ownerOnShared ? SUPABASE_ANON_KEY : '')
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleTestConnection() {
    if (!url.trim() || !anonKey.trim()) {
      setTestStatus('error')
      setTestMessage('Both URL and anon key are required.')
      return
    }

    setTestStatus('testing')
    setTestMessage('')

    try {
      const testClient = createClient(url.trim(), anonKey.trim())
      // Try a simple query to verify the connection works
      const { error } = await testClient.from('exercises').select('id').limit(1)

      if (error) {
        // Some errors are OK — e.g., table doesn't exist yet (the user might not have set up the schema)
        // But auth errors or connection failures are real problems
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          setTestStatus('success')
          setTestMessage('Connected! Tables not set up yet — run the schema setup after saving.')
        } else {
          setTestStatus('error')
          setTestMessage(error.message)
        }
      } else {
        setTestStatus('success')
        setTestMessage('Connected successfully!')
      }
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : 'Connection failed.')
    }
  }

  async function handleSave() {
    if (!url.trim() || !anonKey.trim()) return

    setSaving(true)
    try {
      await saveExternalBackend(url.trim(), anonKey.trim())
      setAnonKey('')
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await clearExternalBackend()
      setUrl('')
      setAnonKey('')
      setTestStatus('idle')
      setTestMessage('')
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : 'Failed to disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-border-default border-t-upper-pull rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-5 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
                Settings
              </h1>
              <p className="text-text-dim text-xs m-0">
                Backend configuration
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6">
        {/* Current status — hidden for app owner on shared backend (the "Your backend" card below covers it) */}
        {!ownerOnShared && (
          <div className={cn(
            'rounded-xl border p-4 mb-6',
            isExternalBackend
              ? 'bg-lower-bg border-lower-border'
              : 'bg-bg-secondary border-border-default'
          )}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <Database className={cn('w-5 h-5', isExternalBackend ? 'text-lower' : 'text-text-muted')} />
              <span className="text-sm font-semibold text-text-primary">
                {isExternalBackend ? 'Connected to your Supabase' : 'Using shared backend'}
              </span>
            </div>
            {isExternalBackend ? (
              <p className="text-text-secondary text-xs ml-[30px]">
                Data is stored on your own Supabase project.
              </p>
            ) : (
              <p className="text-text-muted text-xs ml-[30px]">
                Data is stored on the shared Supabase instance. Connect your own project below if you want a separate backend.
              </p>
            )}
            {isExternalBackend && externalUrl && (
              <div className="mt-2 ml-[30px]">
                <span className="text-text-dim text-[11px] font-mono break-all">{externalUrl}</span>
              </div>
            )}
            {isExternalBackend && (
              <div className="mt-3 ml-[30px] flex flex-wrap items-center gap-2">
                {authMode === 'external-authed' && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                    'bg-lower-bg text-lower border border-lower-border'
                  )}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authenticated (Secure)
                  </span>
                )}
                {authMode === 'external-anon' && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                    'bg-bg-elevated text-text-muted border border-border-default'
                  )}>
                    Anon-only (Simple)
                  </span>
                )}
                {authMode === 'external-error' && (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                    'bg-upper-push-bg/50 text-upper-push border border-upper-push-border'
                  )}>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Auth failed
                  </span>
                )}
                {externalAuthError && authMode !== 'external-authed' && (
                  <span className="text-text-dim text-[11px] max-w-full" title={externalAuthError}>
                    {externalAuthError.length > 50 ? `${externalAuthError.slice(0, 50)}…` : externalAuthError}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Shared backend security info */}
        {!isExternalBackend && user && (
          <div className="rounded-xl border border-lower-border bg-lower-bg/60 p-4 mb-6">
            <div className="flex items-center gap-2.5 mb-2">
              <Lock className="w-5 h-5 text-lower" />
              <span className="text-sm font-semibold text-text-primary">
                {isAppOwner(user.email) ? 'Your backend' : 'Your data is secure'}
              </span>
            </div>
            <p className="text-text-secondary text-xs ml-[30px] mb-2.5">
              {isAppOwner(user.email) ? (
                <>Signed in as <span className="font-medium text-text-primary">{user.email}</span>. You own this Supabase project — full infrastructure control, including RLS policies, edge functions, and storage.</>
              ) : (
                <>Signed in as <span className="font-medium text-text-primary">{user.email}</span>. Row-level security enforces that only you can read or write your own data — no other user on the shared backend can access it.</>
              )}
            </p>
            <div className="ml-[30px] flex flex-wrap gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                'bg-lower-bg text-lower border border-lower-border'
              )}>
                <ShieldCheck className="w-3.5 h-3.5" />
                RLS enforced
              </span>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                'bg-lower-bg text-lower border border-lower-border'
              )}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Google OAuth
              </span>
            </div>
            {!isAppOwner(user.email) && (
              <p className="text-text-dim text-[11px] ml-[30px] mt-2.5">
                Setting up a separate project is optional — useful if you want full infrastructure ownership, but not required for security.
              </p>
            )}
          </div>
        )}

        {/* Connected: show disconnect option */}
        {isExternalBackend && (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-2">
              Manage connection
            </h2>
            <p className="text-text-muted text-xs mb-4">
              Disconnecting will switch back to the shared backend. Your data on the external project is not affected.
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                'border-upper-push-border bg-upper-push-bg text-upper-push hover:bg-upper-push-tag',
                disconnecting && 'opacity-60 cursor-wait'
              )}
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unplug className="w-4 h-4" />
              )}
              Disconnect
            </button>
          </div>
        )}

        {/* Connect form */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-1">
            {ownerOnShared ? 'Your Supabase project' : isExternalBackend ? 'Update connection' : 'Connect your Supabase'}
          </h2>
          <p className="text-text-muted text-xs mb-4">
            {ownerOnShared ? (
              <>
                This is the shared Supabase project you own. Test the connection to verify everything is working.
              </>
            ) : (
              <>
                Enter your Supabase project URL and anon (public) key. Find these in your project's{' '}
                <a
                  href="https://supabase.com/dashboard/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-upper-pull hover:underline inline-flex items-center gap-0.5"
                >
                  API settings <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-text-muted text-xs font-mono mb-1 block">
                Project URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setTestStatus('idle')
                }}
                placeholder="https://xxxxx.supabase.co"
                readOnly={ownerOnShared}
                className={cn(
                  "w-full py-2.5 px-3 bg-bg-primary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover transition-colors",
                  ownerOnShared && "text-text-secondary"
                )}
              />
            </div>

            <div>
              <label className="text-text-muted text-xs font-mono mb-1 block">
                Anon Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => {
                  setAnonKey(e.target.value)
                  setTestStatus('idle')
                }}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                readOnly={ownerOnShared}
                className={cn(
                  "w-full py-2.5 px-3 bg-bg-primary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover transition-colors",
                  ownerOnShared && "text-text-secondary"
                )}
              />
            </div>

            {/* Test result */}
            {testStatus !== 'idle' && (
              <div className={cn(
                'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                testStatus === 'testing' && 'bg-bg-elevated text-text-muted',
                testStatus === 'success' && 'bg-lower-bg text-lower border border-lower-border',
                testStatus === 'error' && 'bg-upper-push-bg text-upper-push border border-upper-push-border',
              )}>
                {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                {testStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {testStatus === 'error' && <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>{testStatus === 'testing' ? 'Testing connection...' : testMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={!url.trim() || !anonKey.trim() || testStatus === 'testing'}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                  'border-border-default bg-bg-primary text-text-secondary hover:border-border-hover',
                  (!url.trim() || !anonKey.trim() || testStatus === 'testing') && 'opacity-40 cursor-not-allowed'
                )}
              >
                Test Connection
              </button>

              {!ownerOnShared && (
                <button
                  onClick={handleSave}
                  disabled={!url.trim() || !anonKey.trim() || saving || testStatus !== 'success'}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
                    'border-lower-border bg-lower-bg text-lower hover:bg-lower-tag',
                    (!url.trim() || !anonKey.trim() || saving || testStatus !== 'success') && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isExternalBackend ? 'Update' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info note */}
        {!ownerOnShared && (
          <p className="text-text-dim text-[11px] mt-4 text-center">
            The anon key is a <span className="text-text-muted">publishable</span> key — safe to store.
            Your project's service role key is never needed.
          </p>
        )}

        {/* AI Token */}
        <AITokenSection />
      </div>
    </div>
  )
}

const SECURITY_META: Record<TokenStorageMode, {
  icon: typeof Monitor
  label: string
  badge: string
  badgeClass: string
  description: string
}> = {
  local: {
    icon: Monitor,
    label: 'Browser',
    badge: 'Browser-held',
    badgeClass: 'bg-bg-elevated text-text-muted border border-border-default',
    description: 'Stored in localStorage on this device. Fast, but accessible to any script running on this page.',
  },
  shared: {
    icon: Cloud,
    label: 'Shared Supabase',
    badge: 'Recommended',
    badgeClass: 'bg-lower-bg text-lower border border-lower-border',
    description: 'Stored server-side on the shared Supabase project and used by the chat edge function without sending the token from the browser on each request.',
  },
  private: {
    icon: HardDrive,
    label: 'Your Supabase',
    badge: 'Advanced',
    badgeClass: 'bg-ai-bg text-ai border border-ai-border',
    description: 'Stored on your own Supabase project. Only use this when Google auth is enabled there; anon-only projects are not safe for secrets.',
  },
}

function AITokenSection() {
  const { user } = useAuth()
  const dataClient = useDataClient()
  const { isExternalBackend, authMode } = useSupabaseSettings()

  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [storedRemotely, setStoredRemotely] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<TokenStorageMode>(getTokenStorageMode)
  const [switching, setSwitching] = useState(false)
  const [showSQL, setShowSQL] = useState(false)
  const [copiedSQL, setCopiedSQL] = useState(false)

  const tokenOpts = {
    userId: user?.id,
    externalClient: isExternalBackend ? dataClient : null,
  }

  const hasToken = !!currentToken
  const isLocalMode = storageMode === 'local'

  const maskedToken = isLocalMode && currentToken && currentToken.length > 12
    ? `${currentToken.slice(0, 6)}••••${currentToken.slice(-4)}`
    : currentToken ? '••••••••' : null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasStoredToken(tokenOpts)
      .then(async (present) => {
        if (cancelled) return
        setStoredRemotely(storageMode !== 'local' && present)
        if (!present) {
          setCurrentToken(null)
          return
        }
        if (storageMode === 'local') {
          const token = await getToken(tokenOpts)
          if (!cancelled) setCurrentToken(token)
          return
        }
        setCurrentToken('__stored__')
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentToken(null)
          setStoredRemotely(false)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id, isExternalBackend, storageMode])

  useEffect(() => {
    if (storageMode === 'private' && authMode !== 'external-authed') {
      setTokenStorageMode(user ? 'shared' : 'local')
      setStorageMode(user ? 'shared' : 'local')
      setShowToken(false)
      setError('Private token storage was disabled because your external Supabase project is not authenticated with Google OAuth.')
    }
  }, [authMode, storageMode, user])

  async function handleSave() {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    setError(null)
    try {
      await saveToken(trimmed, tokenOpts)
      setTokenInput('')
      setCurrentToken(storageMode === 'local' ? trimmed : '__stored__')
      setStoredRemotely(storageMode !== 'local')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save token.'
      if (msg === 'TABLE_MISSING') {
        setError('Your Supabase project needs a user_secrets table. See SQL below.')
        setShowSQL(true)
      } else {
        setError(msg)
      }
    }
  }

  async function handleClear() {
    setError(null)
    try {
      await clearToken(tokenOpts)
      setCurrentToken(null)
      setStoredRemotely(false)
      setTokenInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove token.')
    }
  }

  async function handleModeChange(newMode: TokenStorageMode) {
    if (newMode === storageMode) return
    setSwitching(true)
    setError(null)
    setShowSQL(false)
    const oldMode = storageMode

    try {
      await migrateToken(oldMode, newMode, tokenOpts)
      setStorageMode(newMode)
      invalidateCache()
      const present = await hasStoredToken({ ...tokenOpts })
      setStoredRemotely(newMode !== 'local' && present)
      if (!present) {
        setCurrentToken(null)
      } else if (newMode === 'local') {
        const t = await getToken({ ...tokenOpts })
        setCurrentToken(t)
      } else {
        setCurrentToken('__stored__')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch storage.'
      if (msg === 'TABLE_MISSING') {
        setTokenStorageMode(oldMode)
        setError('Your Supabase project needs a user_secrets table. See SQL below.')
        setShowSQL(true)
      } else {
        setTokenStorageMode(oldMode)
        setError(msg)
      }
    } finally {
      setSwitching(false)
    }
  }

  function handleCopySQL() {
    navigator.clipboard.writeText(PRIVATE_TABLE_SQL)
    setCopiedSQL(true)
    setTimeout(() => setCopiedSQL(false), 2000)
  }

  const availableModes: TokenStorageMode[] = ['local']
  if (user) availableModes.push('shared')
  if (isExternalBackend && authMode === 'external-authed') availableModes.push('private')

  const activeMeta = SECURITY_META[storageMode]

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-4 mt-6">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Sparkles className="w-5 h-5 text-ai" />
        <span className="text-sm font-semibold text-text-primary">AI Token</span>
      </div>
      <p className="text-text-muted text-xs mb-3">
        Add your Claude OAuth token to enable AI features. Get one by running{' '}
        <code className="px-1 py-0.5 rounded bg-bg-primary text-ai text-[11px] font-mono">claude setup-token</code>{' '}
        in your terminal (requires{' '}
        <a
          href="https://docs.anthropic.com/en/docs/claude-code/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="text-upper-pull hover:underline inline-flex items-center gap-0.5"
        >
          Claude Code <ExternalLink className="w-3 h-3" />
        </a>
        ).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
          <span className="text-text-muted text-xs">Loading token…</span>
        </div>
      ) : hasToken ? (
        <div className="mb-3 flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
            'bg-ai-bg text-ai border border-ai-border'
          )}>
            <Check className="w-3.5 h-3.5" />
            Token configured
          </span>
          {isLocalMode && (
            <button
              onClick={() => setShowToken((s) => !s)}
              className="text-text-dim hover:text-text-muted transition-colors"
              title={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      ) : null}

      {hasToken && isLocalMode && showToken && (
        <div className="mb-3">
          <span className="text-text-dim text-[11px] font-mono break-all">{maskedToken}</span>
        </div>
      )}

      {hasToken && storedRemotely && (
        <div className="mb-3">
          <span className="text-text-dim text-[11px]">
            Token is stored server-side and is not displayed back into this UI.
          </span>
        </div>
      )}

      {/* Storage method selector */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-muted text-xs font-medium">Storage method</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {availableModes.map((mode) => {
            const meta = SECURITY_META[mode]
            const Icon = meta.icon
            const isActive = mode === storageMode
            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                disabled={switching}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  isActive
                    ? 'border-ai-border bg-ai-bg/40'
                    : 'border-border-default bg-bg-primary hover:border-border-hover',
                  switching && 'opacity-60 cursor-wait',
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-ai' : 'text-text-muted')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-text-primary' : 'text-text-secondary',
                    )}>
                      {meta.label}
                    </span>
                    <span className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                      meta.badgeClass,
                    )}>
                      {meta.badge}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  isActive ? 'border-ai' : 'border-border-default',
                )}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-ai" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-upper-push-bg text-upper-push border border-upper-push-border">
          <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* SQL helper for private mode table creation */}
      {showSQL && (
        <div className="mb-3 rounded-lg border border-border-default bg-bg-primary p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-[11px] font-medium">
              Create this table on your Supabase project:
            </span>
            <button
              onClick={handleCopySQL}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              {copiedSQL ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedSQL ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-[10px] text-text-dim font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {PRIVATE_TABLE_SQL}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={hasToken ? 'Paste new token to replace' : 'Paste your OAuth token'}
          className="w-full py-2.5 px-3 bg-bg-primary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-ai-border transition-colors"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!tokenInput.trim() || loading}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer',
              'border-ai-border bg-ai-bg text-ai hover:bg-ai-tag',
              (!tokenInput.trim() || loading) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {saved ? 'Saved!' : hasToken ? 'Update' : 'Save'}
          </button>

          {hasToken && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer border-border-default bg-bg-primary text-text-muted hover:text-upper-push hover:border-upper-push-border"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
      </div>

      {isExternalBackend && authMode !== 'external-authed' && (
        <p className="text-text-dim text-[11px] mt-3">
          Your external Supabase project is running in anon-only mode. Private token storage is disabled until Google auth is enabled there.
        </p>
      )}

      <p className="text-text-dim text-[11px] mt-3">
        {activeMeta.description}
      </p>
    </div>
  )
}
