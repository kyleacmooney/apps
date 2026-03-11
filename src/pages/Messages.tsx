import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft, Bell, Check, CheckCheck } from 'lucide-react'
import { getBuiltInMessages, markMessageRead, markAllMessagesRead, type AppMessage } from '@/lib/app-messages'
import { cn } from '@/lib/utils'

export function Messages() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<AppMessage[]>([])

  useEffect(() => {
    setMessages(getBuiltInMessages())
  }, [])

  const unreadCount = messages.filter((m) => !m.read).length

  function handleMarkRead(id: string) {
    markMessageRead(id)
    setMessages(getBuiltInMessages())
  }

  function handleMarkAllRead() {
    markAllMessagesRead()
    setMessages(getBuiltInMessages())
  }

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
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight text-text-primary m-0">
                Messages
              </h1>
              <p className="text-text-dim text-xs m-0">
                App notifications & updates
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-text-dim mx-auto mb-3" />
            <p className="text-text-muted text-sm">No messages yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  msg.read
                    ? 'bg-bg-secondary border-border-default'
                    : 'bg-upper-pull-bg/30 border-upper-pull-border'
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h3 className={cn(
                    'text-sm font-semibold',
                    msg.read ? 'text-text-secondary' : 'text-text-primary'
                  )}>
                    {msg.title}
                  </h3>
                  {!msg.read && (
                    <button
                      onClick={() => handleMarkRead(msg.id)}
                      className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className={cn(
                  'text-xs leading-relaxed',
                  msg.read ? 'text-text-muted' : 'text-text-secondary'
                )}>
                  {msg.content}
                </p>
                <p className="text-text-dim text-[11px] mt-2">
                  {new Date(msg.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
