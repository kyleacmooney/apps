import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Home, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const GUIDES: Record<string, { title: string; subtitle: string; rawUrl: string }> = {
  workouts: {
    title: 'Workout Logging',
    subtitle: 'Claude + Supabase MCP guide',
    rawUrl: 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/workout-logging-instructions.md',
  },
  plants: {
    title: 'Plant Care',
    subtitle: 'Claude + Supabase MCP guide',
    rawUrl: 'https://raw.githubusercontent.com/kyleacmooney/apps/main/docs/plant-care-instructions.md',
  },
}

export function Instructions() {
  const navigate = useNavigate()
  const { guide } = useParams<{ guide: string }>()
  const config = guide ? GUIDES[guide] : undefined
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-bg-primary">
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
                {config?.title ?? 'Guide'}
              </h1>
              <p className="text-text-dim text-xs m-0">
                {config?.subtitle ?? 'Instructions'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6">
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
          <div className={cn(
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
        )}
      </div>
    </div>
  )
}
