export interface AppMessage {
  id: string
  title: string
  content: string
  timestamp: number
  read: boolean
}

const READ_KEY = 'app-messages-read'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function setReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
}

export function getBuiltInMessages(): AppMessage[] {
  const readIds = getReadIds()
  return [
    {
      id: 'welcome-intro',
      title: 'Welcome to Apps',
      content:
        'Use Claude with the Supabase MCP connector to log workouts, add plants, and manage data by conversation. Set up your own backend for full data ownership, or use the shared one to try the app.',
      timestamp: Date.UTC(2025, 5, 1),
      read: readIds.has('welcome-intro'),
    },
  ]
}

export function markMessageRead(id: string) {
  const ids = getReadIds()
  ids.add(id)
  setReadIds(ids)
}

export function markAllMessagesRead() {
  const ids = getReadIds()
  for (const msg of getBuiltInMessages()) {
    ids.add(msg.id)
  }
  setReadIds(ids)
}

export function getUnreadCount(): number {
  return getBuiltInMessages().filter((m) => !m.read).length
}

export function resetMessageRead(id: string) {
  const ids = getReadIds()
  ids.delete(id)
  setReadIds(ids)
}
