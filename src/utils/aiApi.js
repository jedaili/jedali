// ── My_ai FastAPI client (/agent/chat, /agent/chat/stream, /health) ─────────

const DEFAULT_BASE = 'http://127.0.0.1:8000'

const LS_BASE = 'myAiDesktop.apiBase'
const LS_KEY = 'myAiDesktop.apiKey'

/** Normalize URL for desktop HTTP (localhost → 127.0.0.1 avoids some Windows resolver quirks). */
function normalizeApiBase(url) {
  const trimmed = String(url || '').trim().replace(/\/$/, '')
  if (!trimmed) return DEFAULT_BASE
  try {
    const u = new URL(trimmed)
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1'
    return u.toString().replace(/\/$/, '')
  } catch {
    return trimmed
  }
}

/** True when Electron exposes main-process HTTP (required for packaged app / file:// UI). */
export function hasDesktopApiBridge() {
  return typeof window !== 'undefined' && typeof window.electron?.myAiFetch === 'function'
}

/** Resolve API base URL: localStorage → VITE_MY_AI_API_BASE → default */
export function getApiBase() {
  try {
    const ls = localStorage.getItem(LS_BASE)
    if (ls?.trim()) return normalizeApiBase(ls)
  } catch (_) {}
  const env = import.meta.env?.VITE_MY_AI_API_BASE
  if (typeof env === 'string' && env.trim()) return normalizeApiBase(env)
  return DEFAULT_BASE
}

/**
 * API key for header X-API-KEY — must match My_ai (`config.json` → `api.api_key` or env `MY_AI_API_KEY`).
 * Set via localStorage `myAiDesktop.apiKey` or build-time `VITE_MY_AI_API_KEY`. Empty = header omitted (OK only if server auth is disabled in dev).
 */
export function getApiKey() {
  try {
    const ls = localStorage.getItem(LS_KEY)
    if (ls !== null && ls.trim() !== '') return stripLeadingInvisible(ls.trim())
  } catch (_) {}
  const env = import.meta.env?.VITE_MY_AI_API_KEY
  if (typeof env === 'string' && env.trim() !== '') return stripLeadingInvisible(env.trim())
  return ''
}

/** Persist API URL + key in localStorage (same keys the UI reads). Empty strings remove overrides. */
export function saveApiPreferences(apiBase, apiKey) {
  try {
    const b = normalizeApiBase(apiBase)
    const k = stripLeadingInvisible(String(apiKey || '').trim())
    if (b) localStorage.setItem(LS_BASE, b)
    else localStorage.removeItem(LS_BASE)
    if (k) localStorage.setItem(LS_KEY, k)
    else localStorage.removeItem(LS_KEY)
  } catch (_) {}
}

/** BOM / zero-width chars often break copy-paste into headers */
function stripLeadingInvisible(s) {
  return s.replace(/^\uFEFF+/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/**
 * Fetch requires header values to be ISO-8859-1; Arabic/emoji trigger:
 * "String contains non ISO-8859-1 code point"
 */
function ensureLatin1HeaderValue(labelForError, value) {
  const v = stripLeadingInvisible(String(value || '').trim())
  for (const ch of v) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp > 0xff) {
      throw new Error(
        `${labelForError}: only ASCII characters are allowed in HTTP headers (no Arabic letters or emoji). ` +
          'Open ⚙ Connection settings and use the exact API key from My_ai (English letters, numbers, symbols).\n\n' +
          'المفتاح يجب أن يكون بحروف لاتينية فقط (مثل مفتاح config.json) — أعد إدخاله من الإعدادات.'
      )
    }
  }
  return v
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const keyRaw = getApiKey()
  if (!keyRaw) return headers
  headers['X-API-KEY'] = ensureLatin1HeaderValue('API key', keyRaw)
  return headers
}

function buildAgentPayload(messages, { filePath, fileContent, projectRoot }) {
  if (!messages?.length) {
    throw new Error(
      'No messages to send (internal chat state error). Close the chat panel, restart the app, and try again.'
    )
  }
  const last = messages[messages.length - 1]
  const role = (last.role || '').toLowerCase()
  if (role !== 'user') throw new Error('Last message must be from user')

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content ?? '',
  }))

  const context = {
    history,
    ...(projectRoot
      ? {
          project_root: projectRoot,
          projectRoot,
          use_project_context: true,
          // auto_build writes here (workspace folder), not generated_app_from_chat on the server
          build_output_dir: projectRoot,
        }
      : {}),
  }

  if (fileContent != null && filePath) {
    context.active_file_content = String(fileContent).slice(0, 8000)
    context.active_file_name = String(filePath).split(/[/\\]/).pop()
  }

  return {
    message: last.content ?? '',
    context,
  }
}

async function readHttpErrorDetail(res) {
  const text = await res.text().catch(() => '')
  return parseErrorDetailText(text, res.statusText || `HTTP ${res.status}`)
}

function parseErrorDetailText(text, fallback) {
  const trimmed = (text || '').trim()
  if (!trimmed) return fallback
  try {
    const j = JSON.parse(trimmed)
    if (j.detail != null) {
      if (typeof j.detail === 'string') return j.detail
      if (Array.isArray(j.detail)) {
        return j.detail
          .map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x)))
          .filter(Boolean)
          .join('; ')
      }
      return String(j.detail)
    }
    if (j.message) return String(j.message)
  } catch (_) {}
  return trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed
}

function extractReplyBody(data) {
  if (data == null) return ''
  if (typeof data.reply === 'string') return data.reply
  return (
    data.response ??
    data.message?.content ??
    data.message ??
    data.content ??
    data.text ??
    data.answer ??
    data.output ??
    (typeof data === 'string' ? data : JSON.stringify(data))
  )
}

function splitFirstSSEBlock(buffer) {
  const m = buffer.match(/\r?\n\r?\n/)
  if (!m || m.index === undefined) return null
  const idx = m.index
  const delimLen = m[0].length
  return {
    block: buffer.slice(0, idx),
    rest: buffer.slice(idx + delimLen),
  }
}

function isAgentHttpError(err) {
  return err instanceof Error && /^Agent error [45]\d\d:/.test(err.message)
}

function responseFromDesktopFetch(result) {
  const headers = new Headers(result.headers || {})
  return new Response(result.body ?? '', {
    status: result.status || 0,
    statusText: result.statusText || '',
    headers,
  })
}

/** Prefer Electron main-process fetch (no CORS); fall back to renderer fetch in browser preview. */
async function myAiHttp(url, { method = 'GET', headers = {}, body, signal, timeoutMs = 120_000 } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  if (hasDesktopApiBridge()) {
    const desktopFetch = window.electron.myAiFetch
    const abortPromise = signal
      ? new Promise((_, reject) => {
          if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        })
      : null

    const req = desktopFetch({
      url,
      method,
      headers,
      body,
      timeoutMs,
    })
    const result = abortPromise ? await Promise.race([req, abortPromise]) : await req

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    if (!result.status && !result.ok) {
      throw new TypeError(result.statusText || 'Failed to fetch')
    }
    return responseFromDesktopFetch(result)
  }

  return fetch(url, { method, headers, body, signal })
}

/**
 * My_ai SSE: event types ping | reply | done | error; reply carries full JSON payload.
 */
async function handleMyAiSSE(res, { onChunk, onProgress, signal }) {
  const reader = res.body?.getReader?.()
  let buffer = ''
  let fullText = ''

  const processBuffer = () => {
    let split
    while ((split = splitFirstSSEBlock(buffer)) !== null) {
      buffer = split.rest
      let eventType = 'message'
      const dataLines = []
      for (const line of split.block.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      const rawData = dataLines.join('\n').trim()
      if (!rawData) continue

      let json
      try {
        json = JSON.parse(rawData)
      } catch {
        continue
      }

      if (eventType === 'ping') {
        const ms = Number(json.elapsed_ms) || 0
        onProgress?.(Math.round(ms / 1000))
      } else if (eventType === 'reply') {
        const text = extractReplyBody(json)
        fullText = text
        onChunk?.(text)
      } else if (eventType === 'error') {
        throw new Error(json.detail || JSON.stringify(json))
      }
    }
  }

  if (reader) {
    const decoder = new TextDecoder()
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => {})
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      processBuffer()
    }
  } else {
    buffer = await res.text()
    processBuffer()
  }

  return fullText
}

async function postAgentChatStream(payload, signal, { onChunk, onProgress }) {
  const res = await myAiHttp(`${getApiBase()}/agent/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const detail = await readHttpErrorDetail(res)
    throw new Error(`Agent error ${res.status}: ${detail}`)
  }

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    const data = await res.json()
    const text = extractReplyBody(data)
    onChunk?.(text)
    return text
  }

  return handleMyAiSSE(res, { onChunk, onProgress, signal })
}

async function postAgentChat(payload, signal) {
  const res = await myAiHttp(`${getApiBase()}/agent/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) {
    const detail = await readHttpErrorDetail(res)
    throw new Error(`Agent error ${res.status}: ${detail}`)
  }
  return res.json()
}

/**
 * Send chat to My_ai (POST /agent/chat/stream, fallback POST /agent/chat).
 * @param {Array<{role:string, content:string}>} messages — last entry must be user
 * @param {object} options
 * @param {AbortSignal} [options.signal]
 * @param {function} [options.onChunk] — receives full reply text (replaces bubble content)
 * @param {function} [options.onProgress] — seconds elapsed while model thinks (SSE pings)
 * @param {string} [options.filePath]
 * @param {string} [options.fileContent]
 * @param {string} [options.projectRoot] — workspace folder for RAG / study (server-visible path)
 */
export async function sendMessage(messages, options = {}) {
  const payload = buildAgentPayload(messages, options)
  const { signal, onChunk, onProgress } = options

  if (typeof window !== 'undefined' && window.electron && !hasDesktopApiBridge()) {
    throw new Error(
      'Desktop API bridge is missing (outdated app build).\n\n' +
        'Close My AI Desktop completely, then from the project folder run:\n' +
        '  npm run build\n' +
        '  npm run dev\n\n' +
        'If you use the installed .exe, rebuild with npm run build and reinstall from dist-electron.'
    )
  }

  // Electron: use POST /agent/chat via main process (no browser CORS; stream adds no benefit when buffered in IPC).
  if (hasDesktopApiBridge()) {
    onProgress?.(0)
    const data = await postAgentChat(payload, signal)
    const text = extractReplyBody(data)
    if (!text?.trim()) {
      throw new Error(
        'The server returned an empty reply. Check that Ollama is running and a model is loaded, then try again.'
      )
    }
    onChunk?.(text)
    return text
  }

  try {
    const text = await postAgentChatStream(payload, signal, { onChunk, onProgress })
    if (!text?.trim()) {
      throw new Error(
        'The server returned an empty reply. Check that Ollama is running and a model is loaded, then try again.'
      )
    }
    return text
  } catch (e) {
    if (e.name === 'AbortError') throw e
    if (isAgentHttpError(e)) throw e
    const data = await postAgentChat(payload, signal)
    const text = extractReplyBody(data)
    if (!text?.trim()) {
      throw new Error(
        'The server returned an empty reply. Check that Ollama is running and a model is loaded, then try again.'
      )
    }
    onChunk?.(text)
    return text
  }
}

export async function checkHealth() {
  if (typeof window !== 'undefined' && window.electron && !hasDesktopApiBridge()) {
    return false
  }
  try {
    const res = await myAiHttp(`${getApiBase()}/health`, {
      timeoutMs: 8000,
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Verify URL + API key against My_ai (health + minimal agent chat).
 * @returns {{ ok: boolean, message: string }}
 */
export async function testAgentConnection(apiBase, apiKey) {
  if (typeof window !== 'undefined' && window.electron && !hasDesktopApiBridge()) {
    return {
      ok: false,
      message:
        'Desktop API bridge missing — close the app and run `npm run build` then `npm run dev` (or reinstall a freshly built .exe).',
    }
  }
  const base = normalizeApiBase(apiBase || getApiBase())
  const key = stripLeadingInvisible(String(apiKey ?? getApiKey()).trim())

  try {
    const healthRes = await myAiHttp(`${base}/health`, { timeoutMs: 8000 })
    if (!healthRes.ok) {
      return { ok: false, message: `Health check failed (${healthRes.status}). Is My_ai running at ${base}?` }
    }

    const headers = { 'Content-Type': 'application/json' }
    if (key) headers['X-API-KEY'] = ensureLatin1HeaderValue('API key', key)

    const chatRes = await myAiHttp(`${base}/agent/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'ping', context: { history: [] } }),
      timeoutMs: 90_000,
    })

    if (!chatRes.ok) {
      const detail = await readHttpErrorDetail(chatRes)
      if (chatRes.status === 401 || chatRes.status === 403) {
        return {
          ok: false,
          message: `API key rejected (${chatRes.status}): ${detail}. Use the exact value from My_ai config.json → api.api_key.`,
        }
      }
      if (chatRes.status === 503) {
        return { ok: false, message: `Server error (${chatRes.status}): ${detail}. Start Ollama and ensure a model is available.` }
      }
      return { ok: false, message: `Agent error ${chatRes.status}: ${detail}` }
    }

    const data = await chatRes.json()
    const preview = extractReplyBody(data).slice(0, 80)
    return {
      ok: true,
      message: preview
        ? `Connected. Agent replied: “${preview}${preview.length >= 80 ? '…' : ''}”`
        : 'Connected (health OK, agent returned an empty reply — check Ollama/models).',
    }
  } catch (e) {
    const msg = e.message || String(e)
    if (/Failed to fetch|NetworkError|ENOTFOUND|ECONNREFUSED|timed out/i.test(msg)) {
      return { ok: false, message: `Cannot reach ${base}. Start My_ai (e.g. python run_local.py) on that host/port.\n\n${msg}` }
    }
    return { ok: false, message: msg }
  }
}
