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

const LS_CHAT_SESSIONS = 'myAiDesktop.chatSessions'

export function getChatSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_CHAT_SESSIONS) || '[]')
  } catch {
    return []
  }
}

export function saveChatSession(session) {
  const sessions = getChatSessions()
  const idx = sessions.findIndex((s) => s.id === session.id)
  session.updatedAt = new Date().toISOString()
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    sessions.unshift(session)
  }
  try {
    localStorage.setItem(LS_CHAT_SESSIONS, JSON.stringify(sessions))
  } catch (_) {}
  return sessions
}

export function deleteChatSession(id) {
  const sessions = getChatSessions().filter((s) => s.id !== id)
  try {
    localStorage.setItem(LS_CHAT_SESSIONS, JSON.stringify(sessions))
  } catch (_) {}
  return sessions
}

export function createNewSession(messages = [], providerId = 'local-default') {
  const firstUser = messages.find((m) => m.role === 'user')?.content || ''
  const title = firstUser ? firstUser.split('\n')[0].slice(0, 40) + (firstUser.length > 40 ? '…' : '') : 'New Chat'
  const id = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  
  return {
    id,
    title: title.trim() || 'New Chat',
    messages,
    providerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
