import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/context/AuthContext'
import { useSupabaseSettings } from '@/context/SupabaseContext'
import { ArrowLeft, Database, ExternalLink, Loader2, Check, X, Unplug, Home, ShieldCheck, ShieldAlert, Lock } from 'lucide-react'
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

  const [url, setUrl] = useState(externalUrl ?? '')
  const [anonKey, setAnonKey] = useState('')
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
        {/* Current status */}
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

        {/* Shared backend security info */}
        {!isExternalBackend && user && (
          <div className="rounded-xl border border-lower-border bg-lower-bg/60 p-4 mb-6">
            <div className="flex items-center gap-2.5 mb-2">
              <Lock className="w-5 h-5 text-lower" />
              <span className="text-sm font-semibold text-text-primary">
                Your data is secure
              </span>
            </div>
            <p className="text-text-secondary text-xs ml-[30px] mb-2.5">
              Signed in as <span className="font-medium text-text-primary">{user.email}</span>. Row-level security enforces that only you can read or write your own data — no other user on the shared backend can access it.
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
            <p className="text-text-dim text-[11px] ml-[30px] mt-2.5">
              Setting up a separate project is optional — useful if you want full infrastructure ownership, but not required for security.
            </p>
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
            {isExternalBackend ? 'Update connection' : 'Connect your Supabase'}
          </h2>
          <p className="text-text-muted text-xs mb-4">
            Enter your Supabase project URL and anon (public) key. Find these in your project's{' '}
            <a
              href="https://supabase.com/dashboard/project/_/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-upper-pull hover:underline inline-flex items-center gap-0.5"
            >
              API settings <ExternalLink className="w-3 h-3" />
            </a>
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
                className="w-full py-2.5 px-3 bg-bg-primary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover transition-colors"
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
                className="w-full py-2.5 px-3 bg-bg-primary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover transition-colors"
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
            </div>
          </div>
        </div>

        {/* Info note */}
        <p className="text-text-dim text-[11px] mt-4 text-center">
          The anon key is a <span className="text-text-muted">publishable</span> key — safe to store.
          Your project's service role key is never needed.
        </p>

        {/* Show intro again */}
        <p className="text-text-dim text-[11px] mt-6 text-center">
          <Link
            to="/?showIntro=1"
            className="text-text-muted hover:text-text-primary transition-colors underline"
          >
            Show intro again
          </Link>
          {' — what this app does and how to use Claude with Supabase.'}
        </p>
      </div>
    </div>
  )
}
