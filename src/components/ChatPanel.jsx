import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, StopCircle, Trash2, Copy, Check, Bot, User, Sparkles, Code2, Settings, X, FolderOpen, History, Plus } from 'lucide-react'
import {
  sendMessage,
  getApiBase,
  getApiKey,
  saveApiPreferences,
  testAgentConnection,
  hasDesktopApiBridge,
} from '../utils/aiApi'
import { buildChatApiMessages, getChatSessions, saveChatSession, deleteChatSession, createNewSession } from '../utils/chatHistory'

function MessageBlock({ msg, onRetry }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Simple markdown-ish rendering: code blocks, bold, inline code
  const renderContent = (text) => {
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).split('\n')
        const lang = lines[0].trim()
        const code = lines.slice(1).join('\n')
        return (
          <div key={i} style={{
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', marginTop: 8, marginBottom: 8, overflow: 'hidden',
          }}>
            {lang && (
              <div style={{
                padding: '4px 10px', background: 'var(--bg-3)',
                borderBottom: '1px solid var(--border)',
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-2)',
              }}>
                {lang}
              </div>
            )}
            <pre style={{
              padding: 12, margin: 0, fontSize: 11,
              fontFamily: 'var(--font-mono)', color: 'var(--text-0)',
              overflowX: 'auto', lineHeight: 1.6,
            }}>
              <code>{code}</code>
            </pre>
          </div>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} style={{
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 3, padding: '1px 5px',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-2)',
          }}>
            {part.slice(1, -1)}
          </code>
        )
      }
      // Bold **text**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={j} style={{ color: 'var(--text-0)', fontWeight: 600 }}>{bp.slice(2, -2)}</strong>
        }
        return <span key={j}>{bp}</span>
      })
    })
  }

  return (
    <div
      className="animate-fadeIn"
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        background: isUser ? 'transparent' : 'rgba(124,106,247,0.04)',
      }}
    >
      {/* Role header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 20, height: 20, borderRadius: isUser ? '50%' : 5,
          background: isUser ? 'var(--bg-4)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isUser ? <User size={11} /> : <Bot size={11} color="#fff" />}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: isUser ? 'var(--text-2)' : 'var(--accent)',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          {isUser ? 'You' : 'AI Agent'}
        </span>
        {msg.retryUserText && onRetry && (
          <button
            type="button"
            title="Send the same message again"
            onClick={() => onRetry(msg.retryUserText)}
            style={{
              marginLeft: 'auto',
              marginRight: 8,
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
        <button
          onClick={copy}
          style={{ marginLeft: msg.retryUserText ? 0 : 'auto', color: 'var(--text-3)', transition: 'var(--transition)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
        >
          {copied ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
        </button>
      </div>

      {/* Content */}
      <div style={{
        fontSize: 13, lineHeight: 1.65, color: 'var(--text-1)',
        wordBreak: 'break-word',
      }}>
        {msg.streaming ? (
          <span>
            {renderContent(msg.content)}
            <span style={{ animation: 'blink 1s step-end infinite', color: 'var(--accent)', fontWeight: 700 }}>▋</span>
          </span>
        ) : renderContent(msg.content)}
      </div>
    </div>
  )
}

export default function ChatPanel({
  activeFile,
  projectRoot = '',
  workspaceFolderCount = 0,
  workspaceFolders = [],
  primaryWorkspaceRoot = null,
  onPrimaryWorkspaceRootChange,
  agentOnline = true,
}) {
  const defaultMessages = [
    {
      role: 'assistant',
      content:
        'Use ⚙ to set API URL & key. Add a folder via the explorer — its path is sent as `project_root` for study/RAG (see folder badge above when set). Replies may mix indexed facts with model guesses; ask narrowly (“ما الذي يفعله api/app.py؟”) for tighter grounding. Ollama must be running.',
    }
  ]
  const [messages, setMessages] = useState(defaultMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftApiBase, setDraftApiBase] = useState('')
  const [draftApiKey, setDraftApiKey] = useState('')
  const [prefsTick, setPrefsTick] = useState(0)
  const [connTest, setConnTest] = useState(null)
  const [connTesting, setConnTesting] = useState(false)
  const [sessions, setSessions] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const messagesRef = useRef(messages)
  const currentSessionIdRef = useRef(currentSessionId)

  useEffect(() => {
    setSessions(getChatSessions())
  }, [])

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    if (messages.length <= 1) return
    const id = currentSessionIdRef.current
    let sessionToSave
    if (id) {
      const existing = getChatSessions().find(s => s.id === id) || createNewSession(messages)
      existing.id = id
      existing.messages = messages
      sessionToSave = existing
    } else {
      sessionToSave = createNewSession(messages)
      setCurrentSessionId(sessionToSave.id)
    }
    setSessions(saveChatSession(sessionToSave))
  }, [messages])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendWithText = useCallback(async (forcedText) => {
    const text = String(forcedText ?? input).trim()
    if (!text || loading) return
    if (forcedText == null) setInput('')

    const aiId = Date.now()
    const prev = messagesRef.current
    const last = prev[prev.length - 1]

    const isRetry = forcedText != null
      && last?.role === 'assistant'
      && last.retryUserText === text

    // Must build synchronously before setState — assigning inside setMessages caused "No messages".
    const historyForApi = buildChatApiMessages(prev, text, { isRetry })
    if (!historyForApi.length) return

    let nextMessages
    if (isRetry) {
      const base = prev.slice(0, -1)
      const lastTurn = historyForApi[historyForApi.length - 1]
      if (lastTurn?.role === 'user' && lastTurn.content === text && base[base.length - 1]?.role === 'user') {
        nextMessages = [...base, {
          ...last,
          content: '',
          streaming: true,
          retryUserText: undefined,
          id: aiId,
        }]
      } else {
        const userMsg = { role: 'user', content: text }
        nextMessages = [...base, userMsg, {
          ...last,
          content: '',
          streaming: true,
          retryUserText: undefined,
          id: aiId,
        }]
      }
    } else {
      const userMsg = { role: 'user', content: text }
      const aiMsg = { role: 'assistant', content: '', streaming: true, id: aiId }
      nextMessages = [...prev, userMsg, aiMsg]
    }

    messagesRef.current = nextMessages
    setMessages(nextMessages)

    setLoading(true)
    abortRef.current = new AbortController()

    try {
      await sendMessage(historyForApi, {
        signal: abortRef.current.signal,
        filePath: activeFile?.path,
        fileContent: activeFile?.content,
        projectRoot,
        onProgress: (elapsedSec) => {
          setMessages(prev => prev.map(m =>
            m.id === aiId
              ? { ...m, content: `⏳ Thinking… (${elapsedSec}s)`, streaming: true }
              : m
          ))
        },
        onChunk: (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, content: chunk, streaming: true } : m
          ))
        },
      })
    } catch (e) {
      if (e.name !== 'AbortError') {
        let detail = e.message || String(e)
        const isAuth = /401|Invalid API key|403/i.test(detail)
        const isNetwork =
          !isAuth &&
          (/Failed to fetch|NetworkError|load failed|Cannot reach|ECONNREFUSED|timed out/i.test(detail) ||
            e.name === 'TypeError')
        if (isNetwork) {
          detail =
            `Cannot reach the API at ${getApiBase()}. Start My_ai or fix the URL under ⚙ Connection settings.\n\n${detail}`
        }
        if (isAuth) {
          detail +=
            '\n\nOpen **Connection settings** (⚙) and use the same API key as your My_ai server (`api.api_key` / `MY_AI_API_KEY`). Use Latin letters only in the key field.'
        }
        setMessages(prev => prev.map(m =>
          m.id === aiId
            ? {
              ...m,
              content: `⚠️ ${detail}`,
              streaming: false,
              retryUserText: text,
            }
            : m
        ))
      }
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, streaming: false } : m
      ))
      setLoading(false)
    }
  }, [input, loading, activeFile, projectRoot])

  const send = useCallback(() => sendWithText(null), [sendWithText])

  const stop = () => {
    abortRef.current?.abort()
    setLoading(false)
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.streaming ? { ...m, streaming: false } : m
    ))
  }

  const clear = () => {
    messagesRef.current = defaultMessages
    setMessages(defaultMessages)
    setCurrentSessionId(null)
  }

  const openConnectionSettings = () => {
    setDraftApiBase(getApiBase())
    setDraftApiKey(getApiKey())
    setConnTest(null)
    setSettingsOpen(true)
  }

  const saveConnectionSettings = () => {
    saveApiPreferences(draftApiBase, draftApiKey)
    setSettingsOpen(false)
    setPrefsTick((n) => n + 1)
    setConnTest(null)
  }

  const runConnectionTest = async () => {
    setConnTesting(true)
    setConnTest(null)
    try {
      const result = await testAgentConnection(draftApiBase, draftApiKey)
      setConnTest(result)
    } catch (e) {
      setConnTest({ ok: false, message: e.message || String(e) })
    } finally {
      setConnTesting(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Quick prompts
  const quickPrompts = activeFile ? [
    `Explain this ${activeFile.name} file`,
    'Find bugs in this code',
    'Refactor and improve',
    'Write tests for this',
  ] : [
    'What can you do?',
    'Help me debug my code',
    'Explain a concept',
  ]

  return (
    <div style={{
      width: 'var(--chat-width)',
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>AI Chat</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
          {projectRoot ? (
            <span
              title={`${projectRoot}${primaryWorkspaceRoot ? ' (pinned)' : ''}`}
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-2)',
                background: 'var(--bg-3)',
                padding: '2px 7px',
                borderRadius: 99,
                border: '1px solid var(--border)',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
              }}
            >
              <FolderOpen size={8} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
              {projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop()}
            </span>
          ) : null}
          {activeFile && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-2)',
              background: 'var(--accent-2-dim)', padding: '2px 7px',
              borderRadius: 99, border: '1px solid rgba(62,207,207,0.2)',
              flexShrink: 0,
            }}>
              <Code2 size={8} style={{ display: 'inline', marginRight: 3 }} />
              {activeFile.name}
            </span>
          )}
          <button
            type="button"
            title="Chat History"
            onClick={() => setHistoryOpen(!historyOpen)}
            style={{ color: historyOpen ? 'var(--accent)' : 'var(--text-3)', transition: 'var(--transition)', padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { if (!historyOpen) e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { if (!historyOpen) e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <History size={14} />
          </button>
          <button
            type="button"
            title="Connection settings — API URL & API key"
            onClick={openConnectionSettings}
            style={{ color: 'var(--text-3)', transition: 'var(--transition)', padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <Settings size={14} />
          </button>
          <button title="Clear chat" onClick={clear} style={{ color: 'var(--text-3)', transition: 'var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          role="dialog"
          aria-labelledby="conn-settings-title"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setSettingsOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSettingsOpen(false) }}
          tabIndex={-1}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 18px',
              boxShadow: '0 20px 56px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span id="conn-settings-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>
                My_ai connection
              </span>
              <button
                type="button"
                title="Close"
                onClick={() => setSettingsOpen(false)}
                style={{
                  color: 'var(--text-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
              Must match your running My_ai server: URL (no trailing slash) and the same key as{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>api.api_key</code>
              {' '}or{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>MY_AI_API_KEY</code>.
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              API base URL
            </label>
            <input
              type="url"
              value={draftApiBase}
              onChange={(e) => setDraftApiBase(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              autoComplete="off"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 12,
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-0)',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
            />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              API key (X-API-KEY)
            </label>
            <input
              type="password"
              value={draftApiKey}
              onChange={(e) => setDraftApiKey(e.target.value)}
              placeholder="Same as server config"
              autoComplete="off"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 16,
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-0)',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
            />
            {connTest ? (
              <p style={{
                fontSize: 11,
                lineHeight: 1.45,
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: connTest.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${connTest.ok ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`,
                color: connTest.ok ? 'var(--green)' : 'var(--red)',
              }}
              >
                {connTest.message}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={connTesting}
                onClick={runConnectionTest}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-2)',
                  color: 'var(--text-0)',
                  cursor: connTesting ? 'wait' : 'pointer',
                  marginRight: 'auto',
                }}
              >
                {connTesting ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-3)',
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConnectionSettings}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {typeof window !== 'undefined' && window.electron && !hasDesktopApiBridge() ? (
        <div style={{
          padding: '8px 10px',
          fontSize: 10,
          lineHeight: 1.45,
          background: 'rgba(248, 113, 113, 0.12)',
          borderBottom: '1px solid rgba(248, 113, 113, 0.35)',
          color: 'var(--text-1)',
          flexShrink: 0,
        }}
        >
          <strong style={{ color: 'var(--red)' }}>Outdated desktop build</strong>
          {' — '}Close the app, run <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>npm run build</code>
          {' '}then <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>npm run dev</code>
          {' '}(browser UI at :8000 works; old .exe cannot call the API).
        </div>
      ) : null}

      {!agentOnline ? (
        <div style={{
          padding: '8px 10px',
          fontSize: 10,
          lineHeight: 1.45,
          background: 'rgba(248, 113, 113, 0.1)',
          borderBottom: '1px solid rgba(248, 113, 113, 0.35)',
          color: 'var(--text-1)',
          flexShrink: 0,
        }}>
          <strong style={{ color: 'var(--red)' }}>API offline</strong>
          {' — '}
          Health check failed for {getApiBase()}. Confirm My_ai is running and the URL in ⚙ matches.
        </div>
      ) : null}

      {!projectRoot ? (
        <div style={{
          padding: '8px 10px',
          fontSize: 10,
          lineHeight: 1.45,
          background: 'rgba(251, 191, 36, 0.12)',
          borderBottom: '1px solid rgba(251, 191, 36, 0.35)',
          color: 'var(--text-1)',
          flexShrink: 0,
        }}>
          <strong style={{ color: '#eab308' }}>Workspace</strong>
          {' — '}لم يُضف أي مجلد من المستكشف. خادم My_ai إذا لم يستلم مساراً صالحاً يستبدله{' '}
          <strong>بجذر مشروع My_ai نفسه</strong>
          {' '}فيدرس الكود الخاطئ. أضف المجلد الصحيح ثم أعد الطلب.
        </div>
      ) : null}
      {projectRoot && workspaceFolderCount > 1 ? (
        <div style={{
          padding: '8px 10px',
          fontSize: 10,
          lineHeight: 1.45,
          background: 'rgba(124, 106, 247, 0.08)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-2)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <span>
            <strong>AI folder</strong>
            {' — '}
            Multiple roots: choose a fixed folder or leave <strong>Auto</strong> (follows the active editor file).
          </span>
          {onPrimaryWorkspaceRootChange && workspaceFolders.length > 1 && (
            <select
              aria-label="Primary folder for AI context"
              value={primaryWorkspaceRoot || ''}
              onChange={(e) => onPrimaryWorkspaceRootChange(e.target.value ? e.target.value : null)}
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-3)',
                color: 'var(--text-0)',
                maxWidth: 200,
              }}
            >
              <option value="">Auto (active file)</option>
              {workspaceFolders.map((f) => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {/* Messages or History */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {historyOpen ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'var(--bg-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', margin: 0 }}>Chat History</h3>
              <button 
                onClick={() => { setHistoryOpen(false); clear(); }}
                style={{ 
                  fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, 
                  background: 'var(--accent)', color: '#fff', border: 'none', 
                  padding: '5px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                <Plus size={12} /> New Chat
              </button>
            </div>
            {sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                No chat history yet.
              </div>
            ) : (
              sessions.map(s => (
                <div key={s.id} 
                  style={{ 
                    display: 'flex', alignItems: 'flex-start', padding: '10px 12px', 
                    background: s.id === currentSessionId ? 'var(--bg-2)' : 'var(--bg-0)', 
                    border: '1px solid', borderColor: s.id === currentSessionId ? 'var(--accent)' : 'var(--border)', 
                    borderRadius: 'var(--radius)', marginBottom: 8, cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={e => { if (s.id !== currentSessionId) e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                  onMouseLeave={e => { if (s.id !== currentSessionId) e.currentTarget.style.borderColor = 'var(--border)' }}
                  onClick={() => {
                    setMessages(s.messages)
                    setCurrentSessionId(s.id)
                    setHistoryOpen(false)
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', marginBottom: 4 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(s.updatedAt).toLocaleString()} • {s.messages.filter(m => m.role === 'user').length} msg
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this chat?')) {
                        setSessions(deleteChatSession(s.id))
                        if (currentSessionId === s.id) clear()
                      }
                    }}
                    style={{ 
                      color: 'var(--text-3)', background: 'var(--bg-3)', border: '1px solid var(--border)', 
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 5,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    title="Delete chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {messages.map((msg, i) => (
              <MessageBlock key={i} msg={msg} onRetry={sendWithText} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0,
      }}>
        {quickPrompts.slice(0, 3).map(prompt => (
          <button
            key={prompt}
            onClick={() => { setInput(prompt); textareaRef.current?.focus() }}
            style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '4px 8px', color: 'var(--text-2)',
              cursor: 'pointer', transition: 'var(--transition)',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-0)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '0 10px 10px',
        flexShrink: 0,
      }}>
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          transition: 'border-color var(--transition)',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <textarea
            data-chat-input
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask your AI agent… (Enter to send, Shift+Enter for newline)"
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', padding: '10px 12px', fontSize: 12,
              fontFamily: 'var(--font-mono)', color: 'var(--text-0)',
              lineHeight: 1.6,
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 8px', borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }} key={prefsTick}>
              {input.length > 0 ? `${input.length} chars` : getApiBase().replace(/^https?:\/\//, '')}
            </span>
            {loading ? (
              <button onClick={stop} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                color: 'var(--red)', fontSize: 11, cursor: 'pointer',
              }}>
                <StopCircle size={12} /> Stop
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: input.trim() ? 'var(--accent)' : 'var(--bg-4)',
                  borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                  color: input.trim() ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
                  transition: 'var(--transition)',
                  border: 'none',
                }}
              >
                <Send size={11} /> Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
