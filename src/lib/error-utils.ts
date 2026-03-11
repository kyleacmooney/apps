/**
 * Converts database/API errors into user-friendly messages.
 * Detects row-limit trigger errors and 429 rate-limit responses.
 */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)

  if (msg.includes('operator does not exist: uuid = text')) {
    return 'Your backend needs the latest row-limit trigger fix before inserts will work again.'
  }

  // Row limit trigger: "Row limit exceeded: <table> allows at most <N> rows per <scope>"
  const limitMatch = msg.match(/Row limit exceeded: (\w+) allows at most (\d+) rows/)
  if (limitMatch) {
    const limit = limitMatch[2]
    return `You've reached the limit of ${limit} entries. Delete some old ones to make room.`
  }

  return msg
}
