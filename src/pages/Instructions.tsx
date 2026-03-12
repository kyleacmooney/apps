import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/mobile/PageHeader'

const GUIDES: Record<string, { title: string; subtitle: string; rawUrl: string; prologue: string }> = {
  workouts: {
    title: 'Workout Logging',
    subtitle: 'Claude + Supabase MCP guide',
    rawUrl: 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/workout-logging-instructions.md',
    prologue:
      'Copy this guide into Claude.ai project\'s instructions section to let it log workouts to Supabase for you via MCP.',
  },
  plants: {
    title: 'Plant Care',
    subtitle: 'Claude + Supabase MCP guide',
    rawUrl: 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/plant-care-instructions.md',
    prologue:
      'Copy this guide into Claude.ai project\'s instructions section to let it research plants and update your tracker via MCP.',
  },
}

export function Instructions() {
  const { guide } = useParams<{ guide: string }>()
  const config = guide ? GUIDES[guide] : undefined
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!config) {
      setLoading(false)
      setError('Unknown guide.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(config.rawUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`)
        return res.text()
      })
      .then((text) => {
        if (!cancelled) {
          const lines = text.split('\n')
          const withoutTitle = lines[0]?.startsWith('# ') ? lines.slice(1).join('\n').trimStart() : text
          setContent(withoutTitle)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load guide.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [config])

  async function handleCopyAll() {
    if (!content || !config) return
    const text = `# ${config.title}\n\n${content}`

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        title={config?.title ?? 'Guide'}
        subtitle={config?.subtitle ?? 'Instructions'}
        sticky
        showHome
        showBack
      />

      <div className="max-w-lg mx-auto px-5 py-6">
        {config && (
          <p className="text-sm text-text-muted leading-relaxed mb-4">{config.prologue}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-upper-push-border bg-upper-push-bg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-upper-push shrink-0 mt-0.5" />
            <p className="text-upper-push text-sm">{error}</p>
          </div>
        )}

        {content && (
          <div className="rounded-xl border border-border-default bg-bg-secondary">
            <div className="flex items-center justify-end px-4 pt-3 pb-0">
              <button
                onClick={() => void handleCopyAll()}
                disabled={!content || loading}
                className={cn(
                  'inline-flex items-center gap-1.5 min-w-[5.25rem] justify-center px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  'border border-border-default',
                  copied
                    ? 'bg-upper-pull/10 text-upper-pull border-upper-pull/30'
                    : 'bg-bg-primary text-text-secondary hover:border-border-hover',
                )}
                title="Copy all guide text"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy all'}
              </button>
            </div>
            <div className={cn(
              'px-4 pb-4 pt-2',
              'prose-custom',
              '[&_h2]:text-base [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:mt-6 [&_h2]:mb-2',
              '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-5 [&_h3]:mb-1.5',
              '[&_h4]:text-xs [&_h4]:font-semibold [&_h4]:text-text-secondary [&_h4]:mt-4 [&_h4]:mb-1',
              '[&_p]:text-text-secondary [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3',
              '[&_ul]:text-text-secondary [&_ul]:text-sm [&_ul]:mb-3 [&_ul]:pl-5 [&_ul]:list-disc',
              '[&_ol]:text-text-secondary [&_ol]:text-sm [&_ol]:mb-3 [&_ol]:pl-5 [&_ol]:list-decimal',
              '[&_li]:mb-1 [&_li]:leading-relaxed',
              '[&_code]:text-[12px] [&_code]:font-mono [&_code]:bg-bg-elevated [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-upper-pull',
              '[&_pre]:bg-bg-elevated [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_pre]:leading-relaxed',
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-text-secondary',
              '[&_strong]:text-text-primary [&_strong]:font-semibold',
              '[&_a]:text-upper-pull [&_a]:underline',
              '[&_hr]:border-border-default [&_hr]:my-6',
              '[&_blockquote]:border-l-2 [&_blockquote]:border-border-default [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted',
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
