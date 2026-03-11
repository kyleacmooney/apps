import { useState, useEffect } from 'react'
import { Bell, Check, CheckCheck, MailOpen } from 'lucide-react'
import { getBuiltInMessages, markMessageRead, markAllMessagesRead, resetMessageRead, addMessagesChangeListener, type AppMessage } from '@/lib/app-messages'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/mobile/PageHeader'

export function Messages() {
  const [messages, setMessages] = useState<AppMessage[]>([])

  useEffect(() => {
    const updateMessages = () => {
      setMessages(getBuiltInMessages())
    }
    updateMessages()
    return addMessagesChangeListener(updateMessages)
  }, [])

  const unreadCount = messages.filter((m) => !m.read).length

  function handleMarkRead(id: string) {
    markMessageRead(id)
    setMessages(getBuiltInMessages())
  }

  function handleMarkUnread(id: string) {
    resetMessageRead(id)
    setMessages(getBuiltInMessages())
  }

  function handleMarkAllRead() {
    markAllMessagesRead()
    setMessages(getBuiltInMessages())
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        title="Messages"
        subtitle="App notifications & updates"
        sticky
        rightActions={
          unreadCount > 0 ? (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-2 rounded-lg bg-bg-secondary border border-border-default text-text-secondary text-xs font-semibold hover:border-border-hover transition-colors"
              title="Mark all as read"
            >
              <span className="inline-flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-text-dim" />
                Mark all read
              </span>
            </button>
          ) : null
        }
      />

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
                  {msg.read ? (
                    <button
                      onClick={() => handleMarkUnread(msg.id)}
                      className="shrink-0 text-text-dim hover:text-text-muted transition-colors"
                      title="Mark as unread"
                    >
                      <MailOpen className="w-4 h-4" />
                    </button>
                  ) : (
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
