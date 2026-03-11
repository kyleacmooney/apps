export interface AppMessage {
  id: string
  title: string
  content: string
  timestamp: number
  read: boolean
}

const READ_KEY = 'app-messages-read'
const HOME_ACK_KEY = 'app-messages-home-ack'
const CHANGE_EVENT = 'app-messages-changed'

function emitChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

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
  emitChange()
}

function getHomeAckIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HOME_ACK_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function setHomeAckIds(ids: Set<string>) {
  localStorage.setItem(HOME_ACK_KEY, JSON.stringify([...ids]))
  emitChange()
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
  acknowledgeHomeMessage(id)
}

export function markAllMessagesRead() {
  const ids = getReadIds()
  for (const msg of getBuiltInMessages()) {
    ids.add(msg.id)
  }
  setReadIds(ids)
  const ackIds = getHomeAckIds()
  for (const msg of getBuiltInMessages()) {
    ackIds.add(msg.id)
  }
  setHomeAckIds(ackIds)
}

export function getUnreadCount(): number {
  return getBuiltInMessages().filter((m) => !m.read).length
}

export function resetMessageRead(id: string) {
  const ids = getReadIds()
  ids.delete(id)
  setReadIds(ids)
}

export function acknowledgeHomeMessage(id: string) {
  const ids = getHomeAckIds()
  ids.add(id)
  setHomeAckIds(ids)
}

export function getHomeMessages(): AppMessage[] {
  const ackIds = getHomeAckIds()
  return getBuiltInMessages().filter((m) => !ackIds.has(m.id))
}

export function addMessagesChangeListener(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}
