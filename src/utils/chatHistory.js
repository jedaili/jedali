/**
 * Build the message list passed to sendMessage / buildAgentPayload.
 * Must run synchronously before setState — never inside a setState updater.
 */
export function buildChatApiMessages(prevMessages, userText, { isRetry = false } = {}) {
  const text = String(userText ?? '').trim()
  if (!text) return []

  const toPayload = (arr) =>
    arr.map(({ role, content }) => ({ role, content: content ?? '' }))

  if (isRetry) {
    const base = prevMessages.slice(0, -1)
    let history = toPayload(base)
    const lastTurn = history[history.length - 1]
    if (!history.length || lastTurn?.role !== 'user' || lastTurn.content !== text) {
      history = [...history, { role: 'user', content: text }]
    }
    return history
  }

  const userMsg = { role: 'user', content: text }
  return toPayload([...prevMessages, userMsg])
}
