import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { useAuth, GOOGLE_CLIENT_ID } from '@/context/AuthContext'
import { useSupabaseSettings } from '@/context/SupabaseContext'
import { usePersistedState } from '@/lib/use-persisted-state'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Database,
  Key,
  FileCode,
  ShieldCheck,
  Bot,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/mobile/PageHeader'

const SCHEMA_RAW_URL = 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/schema.sql'
const SCHEMA_AUTH_RAW_URL = 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/schema-auth.sql'
const SUPABASE_DASHBOARD = 'https://supabase.com/dashboard'
const SUPABASE_API_SETTINGS = 'https://supabase.com/dashboard/project/_/settings/api'

const STEPS = [
  { id: 1, title: 'Create project', icon: Database },
  { id: 2, title: 'Copy credentials', icon: Key },
  { id: 3, title: 'Choose security mode', icon: ShieldCheck },
  { id: 4, title: 'Run schema', icon: FileCode },
  { id: 5, title: 'Connect Claude', icon: Bot },
] as const

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'error'

export function Setup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { saveExternalBackend, isExternalBackend, externalUrl, authMode } = useSupabaseSettings()
  // Scope persisted state to current user so credentials never leak across accounts on shared devices
  const storageKey = user ? `setup-wizard:${user.id}` : 'setup-wizard:guest'
  const [step, setStep] = usePersistedState(`${storageKey}:step`, 1)
  const [url, setUrl] = usePersistedState(`${storageKey}:url`, '')
  const [anonKey, setAnonKey] = usePersistedState(`${storageKey}:anon-key`, '')
  const [securityMode, setSecurityMode] = usePersistedState<'simple' | 'secure'>(`${storageKey}:security-mode`, 'simple')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMessage, setVerifyMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleVerify() {
    if (!url.trim() || !anonKey.trim()) {
      setVerifyStatus('error')
      setVerifyMessage('Enter your project URL and anon key first.')
      return
    }

    setVerifyStatus('verifying')
    setVerifyMessage('')

    try {
      const testClient = createClient(url.trim(), anonKey.trim())
      const { error } = await testClient.from('exercises').select('id').limit(1)

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          setVerifyStatus('error')
          setVerifyMessage('Schema not found. Run the SQL above in your Supabase SQL Editor, then try again.')
        } else {
          setVerifyStatus('error')
          setVerifyMessage(error.message)
        }
        return
      }

      setVerifyStatus('success')
      setVerifyMessage('Tables found. Saving your backend…')

      setSaving(true)
      try {
        await saveExternalBackend(url.trim(), anonKey.trim())
        setVerifyMessage('Backend saved. You can connect Claude in the next step.')
      } catch (err) {
        setVerifyStatus('error')
        setVerifyMessage(err instanceof Error ? err.message : 'Failed to save settings.')
      } finally {
        setSaving(false)
      }
    } catch (err) {
      setVerifyStatus('error')
      setVerifyMessage(err instanceof Error ? err.message : 'Verification failed.')
    }
  }

  async function copySchemaUrl() {
    try {
      await navigator.clipboard.writeText(SCHEMA_RAW_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        title="Set up your backend"
        subtitle={`Step ${step} of ${STEPS.length}`}
        sticky
        showBack={step === 1}
      />

      {/* Step indicator */}
      <div className="max-w-lg mx-auto px-5 pt-4">
        <div className="flex gap-1 mb-6">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                s.id < step ? 'bg-lower' : s.id === step ? 'bg-upper-pull' : 'bg-bg-elevated'
              )}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pb-10">
        {/* Already-configured banner */}
        {isExternalBackend && (
          <div className="rounded-xl border border-lower-border bg-lower-bg/60 p-3 mb-5 flex items-start gap-2.5">
            <Check className="w-4 h-4 text-lower shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Backend already connected</p>
              <p className="text-text-dim text-[11px] font-mono break-all mt-0.5">{externalUrl}</p>
              <p className="text-text-dim text-[11px] mt-1">
                {authMode === 'external-authed' ? 'Authenticated (Secure)' : authMode === 'external-anon' ? 'Anon-only (Simple)' : 'Connected'}
                {' \u00B7 '}You can review each step or change your settings.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Create project */}
        {step === 1 && (
          <div className="space-y-4">
            {isExternalBackend && (
              <div className="rounded-lg border border-lower-border bg-lower-bg/40 px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-lower shrink-0" />
                <span className="text-xs text-lower font-medium">Done — your project is created and connected.</span>
              </div>
            )}
            <p className="text-text-secondary text-sm">
              Create a free Supabase project. You’ll use it to store your workouts, exercises, and plants.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
              <li>Open the Supabase dashboard.</li>
              <li>Click <strong className="text-text-primary">New project</strong>.</li>
              <li>Pick a name, password, and region, then create the project.</li>
            </ol>
            <a
              href={SUPABASE_DASHBOARD}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 w-full justify-center py-3 rounded-xl border text-sm font-medium',
                'border-upper-pull-border bg-upper-pull-bg text-upper-pull hover:bg-upper-pull-tag transition-colors no-underline'
              )}
            >
              Open Supabase Dashboard
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-text-dim text-xs">
              When your project is ready, go to the next step to paste your credentials.
            </p>
          </div>
        )}

        {/* Step 2: Copy credentials */}
        {step === 2 && (
          <div className="space-y-4">
            {isExternalBackend && externalUrl && (
              <div className="rounded-lg border border-lower-border bg-lower-bg/40 px-3 py-2 flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-lower shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-lower font-medium">Saved</span>
                  <p className="text-text-dim text-[11px] font-mono break-all mt-0.5">{externalUrl}</p>
                </div>
              </div>
            )}
            <p className="text-text-secondary text-sm">
              In your project, open <strong className="text-text-primary">Settings → API</strong> and copy your
              project URL and the <strong className="text-text-primary">anon public</strong> key.
            </p>
            <a
              href={SUPABASE_API_SETTINGS}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-upper-pull hover:underline"
            >
              API settings <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="space-y-3">
              <div>
                <label className="text-text-muted text-xs font-mono mb-1 block">Project URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xxxxx.supabase.co"
                  className="w-full py-2.5 px-3 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover"
                />
              </div>
              <div>
                <label className="text-text-muted text-xs font-mono mb-1 block">Anon key</label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  className="w-full py-2.5 px-3 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-base font-mono placeholder:text-text-dim outline-none focus:border-border-hover"
                />
              </div>
            </div>
            <p className="text-text-dim text-xs">
              The anon key is safe to use in the app; never share your service role key.
            </p>
          </div>
        )}

        {/* Step 3: Choose security mode */}
        {step === 3 && (
          <div className="space-y-4">
            {isExternalBackend && (
              <div className="rounded-lg border border-lower-border bg-lower-bg/40 px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-lower shrink-0" />
                <span className="text-xs text-lower font-medium">
                  Currently: {authMode === 'external-authed' ? 'Secure (auth-enabled)' : 'Simple (no auth)'}
                </span>
              </div>
            )}
            <p className="text-text-secondary text-sm">
              Choose how strict you want access control to be on your project. You can start simple and switch to a secure, auth-gated setup later.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSecurityMode('simple')}
                className={cn(
                  'w-full text-left rounded-xl border px-3 py-3 text-sm transition-colors',
                  'bg-bg-secondary border-border-default hover:border-border-hover',
                  securityMode === 'simple' && 'border-lower-border bg-lower-bg/40'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-text-primary">Simple (no auth)</span>
                  {securityMode === 'simple' && <Check className="w-4 h-4 text-lower" />}
                </div>
                <p className="text-text-secondary text-xs mb-1">
                  Permissive RLS. Anyone with your anon key can read and write. Best for single-user projects where the URL is private.
                </p>
                <p className="text-text-dim text-[11px]">
                  Uses <code className="text-text-muted bg-bg-elevated px-1 rounded">docs/schema.sql</code>. The app sends a synthetic
                  user_id so multi-user features still work.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSecurityMode('secure')}
                className={cn(
                  'w-full text-left rounded-xl border px-3 py-3 text-sm transition-colors',
                  'bg-bg-secondary border-border-default hover:border-border-hover',
                  securityMode === 'secure' && 'border-upper-pull-border bg-upper-pull-bg/40'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-text-primary">Secure (auth-enabled)</span>
                  {securityMode === 'secure' && <ShieldCheck className="w-4 h-4 text-upper-pull" />}
                </div>
                <p className="text-text-secondary text-xs mb-1">
                  Auth-gated RLS that uses <code className="text-text-muted bg-bg-elevated px-1 rounded">auth.uid()</code>. Requires Google
                  OAuth on your project. Safer for shared or long-lived backends.
                </p>
                <p className="text-text-dim text-[11px]">
                  You&apos;ll run the base schema first, then an auth patch (
                  <code className="text-text-muted bg-bg-elevated px-1 rounded">docs/schema-auth.sql</code>) once Google is configured.
                </p>
              </button>
            </div>

            <div className="rounded-lg border border-border-default bg-bg-secondary px-3 py-2 mt-2">
              <p className="text-text-muted text-xs font-medium mb-1">How Google OAuth fits in</p>
              <p className="text-text-secondary text-xs mb-1">
                In <strong className="text-text-primary">Secure</strong> mode, both this app and Claude sign in with the same Google
                Identity Services client ID. Supabase uses that identity to enforce row-level security per user.
              </p>
              <p className="text-text-dim text-[11px]">
                You&apos;ll configure the Google provider on your Supabase project using the shared client ID below, so one Google sign-in
                can authenticate both Kyle&apos;s shared backend and your own project.
              </p>
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-text-muted text-xs font-mono">Shared Google client ID</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={GOOGLE_CLIENT_ID ?? ''}
                  readOnly
                  className="flex-1 py-2 px-3 bg-bg-secondary border border-border-default rounded-lg text-text-primary text-base font-mono truncate"
                  placeholder="Set VITE_GOOGLE_CLIENT_ID in your environment"
                />
              </div>
              <p className="text-text-dim text-[11px]">
                In Supabase, go to <span className="font-medium">Authentication → Providers → Google</span> and paste this client ID. If
                it&apos;s blank in your fork, set <code className="text-text-muted bg-bg-elevated px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>{' '}
                before building.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Run schema + verify */}
        {step === 4 && (
          <div className="space-y-4">
            {isExternalBackend && (
              <div className="rounded-lg border border-lower-border bg-lower-bg/40 px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-lower shrink-0" />
                <span className="text-xs text-lower font-medium">Done — backend is verified and saved.</span>
              </div>
            )}
            <p className="text-text-secondary text-sm">
              Create the tables and policies the app needs, then confirm the app can reach your project. In your Supabase project, open the{' '}
              <strong className="text-text-primary">SQL Editor</strong>.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
              <li>Click <strong className="text-text-primary">New query</strong>.</li>
              <li>
                Open{' '}
                <code className="text-text-muted bg-bg-elevated px-1 rounded">
                  {securityMode === 'secure' ? 'docs/schema.sql + docs/schema-auth.sql' : 'docs/schema.sql'}
                </code>{' '}
                and copy the SQL you need.
              </li>
              <li>Paste into the editor and click <strong className="text-text-primary">Run</strong>.</li>
            </ol>
            <a
              href={SCHEMA_RAW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 w-full justify-center py-3 rounded-xl border text-sm font-medium',
                'border-border-default bg-bg-secondary text-text-primary hover:border-border-hover transition-colors no-underline'
              )}
            >
              Open schema.sql (copy all)
              <ExternalLink className="w-4 h-4" />
            </a>
            {securityMode === 'secure' && (
              <a
                href={SCHEMA_AUTH_RAW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 w-full justify-center py-3 rounded-xl border text-sm font-medium',
                  'border-border-default bg-bg-secondary text-text-primary hover:border-border-hover transition-colors no-underline'
                )}
              >
                Open schema-auth.sql (copy all)
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={copySchemaUrl}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border border-border-default text-text-muted text-xs',
                copied && 'border-lower text-lower'
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied link' : 'Copy raw file link'}
            </button>
            <p className="text-text-dim text-xs">
              This creates exercises, workouts, plants, care schedules, and storage. If you chose{' '}
              <strong className="text-text-primary">Secure</strong>, run the auth patch from{' '}
              <code className="text-text-muted bg-bg-elevated px-1 rounded">docs/schema-auth.sql</code> after turning on Google.
            </p>
            {verifyStatus !== 'idle' && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  verifyStatus === 'verifying' && 'bg-bg-elevated text-text-muted',
                  verifyStatus === 'success' && 'bg-lower-bg text-lower border border-lower-border',
                  verifyStatus === 'error' && 'bg-upper-push-bg text-upper-push border border-upper-push-border'
                )}
              >
                {verifyStatus === 'verifying' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                {verifyStatus === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                {verifyStatus === 'error' && <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>{verifyMessage}</span>
              </div>
            )}
            <button
              onClick={handleVerify}
              disabled={!url.trim() || !anonKey.trim() || verifyStatus === 'verifying' || saving}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium w-full justify-center',
                'border-lower-border bg-lower-bg text-lower hover:bg-lower-tag',
                (!url.trim() || !anonKey.trim() || verifyStatus === 'verifying' || saving) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {(verifyStatus === 'verifying' || saving) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Verify & save backend
            </button>
            {!url.trim() || !anonKey.trim() ? (
              <p className="text-text-dim text-xs">
                Enter your URL and anon key in Step 2 first.
              </p>
            ) : null}
          </div>
        )}

        {/* Step 5: Connect Claude */}
        {step === 5 && (
          <div className="space-y-4">
            {isExternalBackend && (
              <div className="rounded-lg border border-lower-border bg-lower-bg/40 px-3 py-2 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-lower shrink-0" />
                <span className="text-xs text-lower font-medium">Your backend is already saved.</span>
              </div>
            )}
            <p className="text-text-secondary text-sm">
              Use Claude with the Supabase MCP connector so you can log workouts, add plants, and manage data by conversation. Your app data lives in your Supabase project; Claude talks to it via MCP.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-text-secondary text-sm">
              <li>In Claude (Code or app), add the Supabase MCP server.</li>
              <li>Configure it with your Supabase project URL and anon key (same as in Step 2).</li>
              <li>
                Use the connector to run SQL, insert workouts, update plants, and follow the in-app guides:
                <div className="flex flex-col gap-1.5 mt-2 ml-1">
                  <a
                    href="#/instructions/workouts"
                    className="flex items-center gap-1.5 text-upper-pull hover:underline text-xs"
                  >
                    Workout logging guide <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="#/instructions/plants"
                    className="flex items-center gap-1.5 text-upper-pull hover:underline text-xs"
                  >
                    Plant care guide <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </li>
            </ol>
            <p className="text-text-dim text-xs">
              {isExternalBackend
                ? 'Your backend is already saved. You can change or disconnect it anytime in Settings.'
                : 'Your backend is already saved. You can change or disconnect it anytime in Settings.'}
            </p>
          </div>
        )}

        {/* Back / Next row at bottom */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium',
                'border-border-default bg-bg-secondary text-text-primary hover:border-border-hover'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(step + 1)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium',
                'border-upper-pull-border bg-upper-pull-bg text-upper-pull hover:bg-upper-pull-tag'
              )}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                setStep(1)
                setUrl('')
                setAnonKey('')
                setSecurityMode('simple')
                navigate('/')
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium',
                'border-lower-border bg-lower-bg text-lower hover:bg-lower-tag'
              )}
            >
              <Check className="w-4 h-4" />
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
