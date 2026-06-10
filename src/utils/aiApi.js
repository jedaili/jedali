// ── My_ai and Generic Providers API Client ─────────
import { getActiveProvider } from './modelProviders'

/** Normalize URL for desktop HTTP (localhost → 127.0.0.1 avoids some Windows resolver quirks). */
function normalizeApiBase(url) {
  const trimmed = String(url || '').trim().replace(/\/$/, '')
  if (!trimmed) return ''
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

/** BOM / zero-width chars often break copy-paste into headers */
function stripLeadingInvisible(s) {
  return s.replace(/^\uFEFF+/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/**
 * Fetch requires header values to be ISO-8859-1.
 */
function ensureLatin1HeaderValue(labelForError, value) {
  const v = stripLeadingInvisible(String(value || '').trim())
  for (const ch of v) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp > 0xff) {
      throw new Error(
        `${labelForError}: only ASCII characters are allowed in HTTP headers. ` +
        'Please use valid Latin characters for the API key.'
      )
    }
  }
  return v
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
    if (j.error && j.error.message) return j.error.message // OpenAI/Anthropic format
    if (j.detail != null) {
      if (typeof j.detail === 'string') return j.detail
      if (Array.isArray(j.detail)) {
        return j.detail.map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x))).filter(Boolean).join('; ')
      }
      return String(j.detail)
    }
    if (j.message) return String(j.message)
  } catch (_) {}
  return trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed
}

function extractLocalReplyBody(data) {
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

function responseFromDesktopFetch(result) {
  const headers = new Headers(result.headers || {})
  return new Response(result.body ?? '', {
    status: result.status || 0,
    statusText: result.statusText || '',
    headers,
  })
}

/** Prefer Electron main-process fetch (no CORS); fall back to renderer fetch in browser preview. */
async function desktopFetchFallback(url, { method = 'GET', headers = {}, body, signal, timeoutMs = 120_000 } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  if (hasDesktopApiBridge()) {
    const desktopFetch = window.electron.myAiFetch
    const abortPromise = signal
      ? new Promise((_, reject) => {
          if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        })
      : null

    const req = desktopFetch({ url, method, headers, body, timeoutMs })
    const result = abortPromise ? await Promise.race([req, abortPromise]) : await req

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    if (!result.status && !result.ok) {
      throw new TypeError(result.statusText || 'Failed to fetch')
    }
    return responseFromDesktopFetch(result)
  }

  return fetch(url, { method, headers, body, signal })
}

// ============================================================================
// PROVIDER SPECIFIC LOGIC
// ============================================================================

function buildSystemContext(options) {
  let sys = ''
  if (options.projectRoot) {
    sys += `Project Root: ${options.projectRoot}\n`
  }
  if (options.filePath && options.fileContent) {
    const fname = String(options.filePath).split(/[/\\]/).pop()
    sys += `Active File: ${fname}\n\n\`\`\`\n${String(options.fileContent).slice(0, 8000)}\n\`\`\`\n`
  }
  return sys
}

// ── LOCAL ───────────────────────────────────────────────────────────────────

function buildLocalPayload(messages, options) {
  if (!messages?.length) throw new Error('No messages to send.')
  const last = messages[messages.length - 1]
  const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content ?? '' }))
  
  const context = { history }
  if (options.projectRoot) {
    context.project_root = options.projectRoot
    context.projectRoot = options.projectRoot
    context.use_project_context = true
    context.build_output_dir = options.projectRoot
  }
  if (options.fileContent != null && options.filePath) {
    context.active_file_content = String(options.fileContent).slice(0, 8000)
    context.active_file_name = String(options.filePath).split(/[/\\]/).pop()
  }

  return { message: last.content ?? '', context }
}

async function sendLocalAgentMessage(provider, messages, options) {
  const payload = buildLocalPayload(messages, options)
  const base = normalizeApiBase(provider.apiBase || 'http://127.0.0.1:8000')
  const headers = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['X-API-KEY'] = ensureLatin1HeaderValue('API key', provider.apiKey)

  const res = await desktopFetchFallback(`${base}/agent/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!res.ok) {
    const detail = await readHttpErrorDetail(res)
    throw new Error(`Agent error ${res.status}: ${detail}`)
  }

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    const data = await res.json()
    const text = extractLocalReplyBody(data)
    options.onChunk?.(text)
    return text
  }

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
      try { json = JSON.parse(rawData) } catch { continue }

      if (eventType === 'ping') {
        options.onProgress?.(Math.round((Number(json.elapsed_ms) || 0) / 1000))
      } else if (eventType === 'reply') {
        fullText = extractLocalReplyBody(json)
        options.onChunk?.(fullText)
      } else if (eventType === 'error') {
        throw new Error(json.detail || JSON.stringify(json))
      }
    }
  }

  if (reader) {
    const decoder = new TextDecoder()
    while (true) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
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

// ── OPENAI ──────────────────────────────────────────────────────────────────

async function sendOpenAIMessage(provider, messages, options) {
  const base = normalizeApiBase(provider.apiBase || 'https://api.openai.com/v1')
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ensureLatin1HeaderValue('API key', provider.apiKey)}`
  }
  
  const payloadMessages = [...messages]
  const sysContext = buildSystemContext(options)
  if (sysContext) {
    payloadMessages.unshift({ role: 'system', content: sysContext })
  }

  const res = await desktopFetchFallback(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.modelName || 'gpt-4o-mini',
      messages: payloadMessages,
      stream: true
    }),
    signal: options.signal,
  })

  if (!res.ok) throw new Error(`OpenAI Error ${res.status}: ${await readHttpErrorDetail(res)}`)

  const reader = res.body?.getReader?.()
  if (!reader) throw new Error("Streaming not supported in this environment")

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    
    let split
    while ((split = splitFirstSSEBlock(buffer)) !== null) {
      buffer = split.rest
      for (const line of split.block.split(/\r?\n/)) {
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]') continue
        try {
          const j = JSON.parse(dataStr)
          const chunk = j.choices?.[0]?.delta?.content
          if (chunk) {
            fullText += chunk
            options.onChunk?.(fullText)
          }
        } catch (_) {}
      }
    }
  }
  return fullText
}

// ── ANTHROPIC ───────────────────────────────────────────────────────────────

async function sendAnthropicMessage(provider, messages, options) {
  const base = normalizeApiBase(provider.apiBase || 'https://api.anthropic.com/v1')
  const headers = { 
    'Content-Type': 'application/json',
    'x-api-key': ensureLatin1HeaderValue('API key', provider.apiKey),
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true' // Helpful if falling back to renderer fetch
  }
  
  const sysContext = buildSystemContext(options)
  
  const res = await desktopFetchFallback(`${base}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.modelName || 'claude-3-5-sonnet-20241022',
      messages: messages.map(m => ({ role: m.role, content: m.content })), // enforce format
      system: sysContext || undefined,
      max_tokens: 4096,
      stream: true
    }),
    signal: options.signal,
  })

  if (!res.ok) throw new Error(`Anthropic Error ${res.status}: ${await readHttpErrorDetail(res)}`)

  const reader = res.body?.getReader?.()
  if (!reader) throw new Error("Streaming not supported")

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    
    let split
    while ((split = splitFirstSSEBlock(buffer)) !== null) {
      buffer = split.rest
      let eventType = ''
      let dataStr = ''
      for (const line of split.block.split(/\r?\n/)) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        else if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
      }
      if (eventType === 'content_block_delta' && dataStr) {
        try {
          const j = JSON.parse(dataStr)
          if (j.delta?.text) {
            fullText += j.delta.text
            options.onChunk?.(fullText)
          }
        } catch (_) {}
      }
    }
  }
  return fullText
}

// ── GEMINI ──────────────────────────────────────────────────────────────────

async function sendGeminiMessage(provider, messages, options) {
  const base = normalizeApiBase(provider.apiBase || 'https://generativelanguage.googleapis.com/v1beta')
  const model = provider.modelName || 'gemini-1.5-flash'
  const key = ensureLatin1HeaderValue('API key', provider.apiKey)
  
  const headers = { 'Content-Type': 'application/json' }
  
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  
  const sysContext = buildSystemContext(options)
  const payload = { contents }
  if (sysContext) {
    payload.systemInstruction = { parts: [{ text: sysContext }] }
  }

  const res = await desktopFetchFallback(`${base}/models/${model}:streamGenerateContent?key=${key}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!res.ok) throw new Error(`Gemini Error ${res.status}: ${await readHttpErrorDetail(res)}`)

  const reader = res.body?.getReader?.()
  if (!reader) throw new Error("Streaming not supported")

  const decoder = new TextDecoder()
  let fullText = ''
  
  // Gemini returns a JSON array over time but chunked oddly, we just parse JSON fragments or accumulate
  // It's technically Server-Sent Events, but without `event:` wrappers. It usually streams as a JSON array `[\n { ... }, \n { ... } \n]`
  let rawBuffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    rawBuffer += decoder.decode(value, { stream: true })
    
    // We can extract "text": "..." using regex as a simple resilient streaming parser
    // Or parse valid blocks. A simple regex approach works well for Gemini stream content:
    const matches = [...rawBuffer.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)]
    let accumulated = ''
    for (const m of matches) {
      try { accumulated += JSON.parse(`"${m[1]}"`) } catch (_) {}
    }
    if (accumulated.length > fullText.length) {
      fullText = accumulated
      options.onChunk?.(fullText)
    }
  }
  return fullText
}

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

export async function sendMessage(messages, options = {}) {
  const { provider } = options
  if (!provider) throw new Error('No provider selected')

  options.onProgress?.(0)

  if (provider.type === 'openai') {
    return sendOpenAIMessage(provider, messages, options)
  } else if (provider.type === 'anthropic') {
    return sendAnthropicMessage(provider, messages, options)
  } else if (provider.type === 'gemini') {
    return sendGeminiMessage(provider, messages, options)
  } else {
    // Local or custom
    return sendLocalAgentMessage(provider, messages, options)
  }
}

export async function testProviderConnection(provider) {
  if (!provider) return { ok: false, message: 'Invalid provider' }

  try {
    if (provider.type === 'openai') {
      const base = normalizeApiBase(provider.apiBase || 'https://api.openai.com/v1')
      const res = await desktopFetchFallback(`${base}/models`, {
        headers: { 'Authorization': `Bearer ${provider.apiKey}` },
        timeoutMs: 10000
      })
      if (res.ok) return { ok: true, message: 'Connected to OpenAI successfully.' }
      throw new Error(`OpenAI Error: ${await readHttpErrorDetail(res)}`)
      
    } else if (provider.type === 'anthropic') {
      // Test via a minimal message
      const base = normalizeApiBase(provider.apiBase || 'https://api.anthropic.com/v1')
      const res = await desktopFetchFallback(`${base}/messages`, {
        method: 'POST',
        headers: { 
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: provider.modelName || 'claude-3-5-sonnet-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        timeoutMs: 10000
      })
      if (res.ok) return { ok: true, message: 'Connected to Anthropic successfully.' }
      throw new Error(`Anthropic Error: ${await readHttpErrorDetail(res)}`)

    } else if (provider.type === 'gemini') {
      const base = normalizeApiBase(provider.apiBase || 'https://generativelanguage.googleapis.com/v1beta')
      const res = await desktopFetchFallback(`${base}/models?key=${provider.apiKey}`, { timeoutMs: 10000 })
      if (res.ok) return { ok: true, message: 'Connected to Google Gemini successfully.' }
      throw new Error(`Gemini Error: ${await readHttpErrorDetail(res)}`)

    } else {
      // Local agent
      const base = normalizeApiBase(provider.apiBase || 'http://127.0.0.1:8000')
      const healthRes = await desktopFetchFallback(`${base}/health`, { timeoutMs: 8000 })
      if (!healthRes.ok) return { ok: false, message: `Health check failed (${healthRes.status}). Is My_ai running at ${base}?` }
      
      const headers = { 'Content-Type': 'application/json' }
      if (provider.apiKey) headers['X-API-KEY'] = ensureLatin1HeaderValue('API key', provider.apiKey)
      
      const chatRes = await desktopFetchFallback(`${base}/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: 'ping', context: { history: [] } }),
        timeoutMs: 15000,
      })
      if (!chatRes.ok) {
        const detail = await readHttpErrorDetail(chatRes)
        return { ok: false, message: `Agent error ${chatRes.status}: ${detail}` }
      }
      return { ok: true, message: 'Connected to Local Agent successfully.' }
    }
  } catch (e) {
    const msg = e.message || String(e)
    if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg)) {
      return { ok: false, message: `Network error. Cannot reach API: ${msg}` }
    }
    return { ok: false, message: msg }
  }
}

export async function checkHealth() {
  const provider = getActiveProvider()
  if (!provider) return false
  if (provider.type !== 'local') return true // Assume external APIs are healthy for UI status indicator
  try {
    const base = normalizeApiBase(provider.apiBase || 'http://127.0.0.1:8000')
    const res = await desktopFetchFallback(`${base}/health`, { timeoutMs: 5000 })
    return res.ok
  } catch {
    return false
  }
}

export async function requestInlineCompletion(provider, textBefore, textAfter, language) {
  if (!provider) return null

  const prompt = `You are a strict code completion engine for ${language}.
Return ONLY the exact code that should be inserted at the cursor position. 
DO NOT include any markdown formatting like \`\`\`.
DO NOT add explanations.
DO NOT repeat the code before or after the cursor unless it's part of the completion.

<CodeBeforeCursor>
${textBefore.slice(-1000)}
</CodeBeforeCursor>

<CodeAfterCursor>
${textAfter.slice(0, 500)}
</CodeAfterCursor>

Complete the code:`

  const messages = [{ role: 'user', content: prompt }]

  try {
    if (provider.type === 'openai') {
      const base = normalizeApiBase(provider.apiBase || 'https://api.openai.com/v1')
      const res = await desktopFetchFallback(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ensureLatin1HeaderValue('API key', provider.apiKey)}`
        },
        body: JSON.stringify({
          model: provider.modelName || 'gpt-4o-mini',
          messages,
          max_tokens: 60,
          temperature: 0.2,
          stream: false
        }),
        timeoutMs: 10000,
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices?.[0]?.message?.content || null

    } else if (provider.type === 'anthropic') {
      const base = normalizeApiBase(provider.apiBase || 'https://api.anthropic.com/v1')
      const res = await desktopFetchFallback(`${base}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': ensureLatin1HeaderValue('API key', provider.apiKey),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: provider.modelName || 'claude-3-5-sonnet-20241022',
          messages,
          max_tokens: 60,
          temperature: 0.2,
          stream: false
        }),
        timeoutMs: 10000,
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.content?.[0]?.text || null

    } else if (provider.type === 'gemini') {
      const base = normalizeApiBase(provider.apiBase || 'https://generativelanguage.googleapis.com/v1beta')
      const key = ensureLatin1HeaderValue('API key', provider.apiKey)
      const res = await desktopFetchFallback(`${base}/models/${provider.modelName || 'gemini-1.5-flash'}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 60, temperature: 0.2 }
        }),
        timeoutMs: 10000,
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null

    } else {
      // Local Agent
      const base = normalizeApiBase(provider.apiBase || 'http://127.0.0.1:8000')
      const headers = { 'Content-Type': 'application/json' }
      if (provider.apiKey) headers['X-API-KEY'] = ensureLatin1HeaderValue('API key', provider.apiKey)
      
      const res = await desktopFetchFallback(`${base}/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: prompt,
          context: { history: [], completion_mode: true }
        }),
        timeoutMs: 10000,
      })
      if (!res.ok) return null
      const data = await res.json()
      return extractLocalReplyBody(data)
    }
  } catch (e) {
    // Fail silently for inline completions
    console.warn('Inline completion failed:', e)
    return null
  }
}
