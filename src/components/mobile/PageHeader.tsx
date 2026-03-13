import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string | ReactNode
  subtitle?: string
  showBack?: boolean
  showHome?: boolean
  leftActions?: ReactNode
  rightActions?: ReactNode
  children?: ReactNode
  className?: string
  sticky?: boolean
}

export function PageHeader({
  title,
  subtitle,
  showBack = true,
  showHome = true,
  leftActions,
  rightActions,
  children,
  className,
  sticky = false,
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'border-b border-border-default bg-bg-primary/95 backdrop-blur-sm z-10',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="max-w-2xl mx-auto px-5 pt-4 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {leftActions}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2.5">
                {typeof title === 'string' ? (
                  <h1 className="text-xl font-bold tracking-tight text-text-primary m-0 truncate">
                    {title}
                  </h1>
                ) : (
                  <div className="flex items-baseline gap-2.5 min-w-0 flex-1">
                    {title}
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-text-dim text-xs m-0 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rightActions}
            {showHome && (
              <button
                onClick={() => navigate('/')}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
