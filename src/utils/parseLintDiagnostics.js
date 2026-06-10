import { normPathKey } from './pathNorm'

/**
 * Extract file / line / column from common ESLint (stylish, compact, unix), TypeScript, and unix-style tool output.
 * Paths are resolved against workspaceRoot when relative.
 */

function resolvePath(filePath, workspaceRoot) {
  const p = String(filePath || '').trim()
  if (!p) return ''
  if (/^[A-Za-z]:[\\/]/i.test(p) || p.startsWith('\\\\')) return p
  if (p.startsWith('/')) return p
  const root = String(workspaceRoot || '').replace(/[/\\]+$/, '')
  if (!root) return p
  const rel = p.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  const base = root.replace(/\\/g, '/')
  return `${base}/${rel}`
}

function looksLikeFilePath(s) {
  const t = String(s || '').trim()
  if (!t || t.length > 4096) return false
  if (/^https?:\/\//i.test(t)) return false
  return /[/\\]/.test(t) || /^\.[/\\]/.test(t) || /\.[a-zA-Z0-9]{1,8}$/.test(t.split(/[/\\]/).pop() || '')
}

function isSummaryLine(t) {
  const s = t.trim()
  return /^✖|✖\s*\d+|\d+\s+problems?\s*\(|^\d+\s+errors?\s*$|^\d+\s+warnings?\s*$/i.test(s)
    || /\d+\s+problem/i.test(s)
}

/**
 * ESLint "compact" formatter: path ends then `: line N, col M, Error|Warning - message`
 */
function tryCompactFormatter(line, push) {
  const anchor = line.search(/:\s*line\s+\d+/i)
  if (anchor <= 0) return false
  const pathPart = line.slice(0, anchor).trim()
  if (!looksLikeFilePath(pathPart)) return false
  const tail = line.slice(anchor)
  const m = tail.match(/^:\s*line\s+(\d+),\s*col\s+(\d+),\s*(Error|Warning)\s+-\s*(.+)$/i)
  if (!m) return false
  push(pathPart, m[1], m[2], m[4].trim(), m[3].toLowerCase() === 'warning' ? 'warning' : 'error')
  return true
}

/**
 * @param {string} raw
 * @param {string} [workspaceRoot]
 * @returns {{ path: string, line: number, column: number, message: string, severity: 'error'|'warning'|'info' }[]}
 */
export function parseLintDiagnostics(raw, workspaceRoot) {
  if (!raw || typeof raw !== 'string') return []
  const lines = raw.split(/\r?\n/)
  const seen = new Set()
  const out = []

  const push = (filePath, line, column, message, severity) => {
    const pathResolved = resolvePath(filePath, workspaceRoot)
    const ln = Math.max(1, parseInt(line, 10) || 1)
    const col = Math.max(1, parseInt(column, 10) || 1)
    const msg = String(message || '').trim()
    if (!pathResolved || !msg) return
    const key = `${normPathKey(pathResolved)}|${ln}|${col}|${msg.slice(0, 120)}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      path: pathResolved,
      line: ln,
      column: col,
      message: msg,
      severity: severity || 'error',
    })
  }

  let stylishFile = ''

  for (let rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('✖') || line.startsWith('> ') || /^\d+ errors?$/.test(line)) continue
    if (isSummaryLine(line)) continue

    const sm = rawLine.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+)$/i)
    if (sm && stylishFile) {
      let msg = sm[4].trim().replace(/\s{2,}[\w@/-]+$/, '').trim()
      push(stylishFile, sm[1], sm[2], msg, sm[3].toLowerCase() === 'warning' ? 'warning' : 'error')
      continue
    }

    if (tryCompactFormatter(rawLine, push)) {
      stylishFile = ''
      continue
    }

    // TypeScript: src/foo.ts(12,5): error TS2322: ...
    let m = line.match(/^(.+)\((\d+),(\d+)\):\s*(error|warning)\s+(.+)$/i)
    if (m && looksLikeFilePath(m[1])) {
      stylishFile = ''
      push(m[1], m[2], m[3], m[5], m[4].toLowerCase() === 'warning' ? 'warning' : 'error')
      continue
    }

    // path:line:col:message — take the **last** :line:col: so paths like src/App.jsx:10:5 work (not src/App.jsx:10 + line 5)
    if (!/^https?:\/\//i.test(line)) {
      const tripleRe = /:(\d+):(\d+):\s*/g
      let tripleMatch
      let lastIdx = -1
      let ln = ''
      let col = ''
      let tail = ''
      while ((tripleMatch = tripleRe.exec(line)) !== null) {
        lastIdx = tripleMatch.index
        ;[, ln, col] = tripleMatch
        tail = line.slice(tripleMatch.index + tripleMatch[0].length)
      }
      if (lastIdx > 0 && tail) {
        const pathPart = line.slice(0, lastIdx).replace(/[/\\]+$/, '').trimEnd()
        if (!pathPart.endsWith(':') && looksLikeFilePath(pathPart)) {
          stylishFile = ''
          let rest = tail.trim()
          let sev = 'error'
          const w = rest.match(/^(error|warning)\s+/i)
          if (w) {
            sev = w[1].toLowerCase() === 'warning' ? 'warning' : 'error'
            rest = rest.slice(w[0].length).trim()
          }
          push(pathPart, ln, col, rest, sev)
          continue
        }
      }
    }

    // path:line:column  -  error/warning  -  message
    m = line.match(/^(.+?):(\d+):(\d+)\s+-\s+(error|warning)\s+-\s+(.+)$/i)
    if (m && looksLikeFilePath(m[1])) {
      stylishFile = ''
      push(m[1], m[2], m[3], m[5], m[4].toLowerCase() === 'warning' ? 'warning' : 'error')
      continue
    }

    // Loose line-only: path:line: message (column defaults to 1)
    m = line.match(/^(.+?):(\d+):\s+(.+)$/)
    if (m && looksLikeFilePath(m[1])) {
      const third = m[3].trim()
      if (/^\d+:/.test(third)) continue
      stylishFile = ''
      if (/^(error|warning)\s+/i.test(third)) {
        const sev = /^warning/i.test(third) ? 'warning' : 'error'
        push(m[1], m[2], 1, third.replace(/^(error|warning)\s+/i, '').trim(), sev)
      } else {
        push(m[1], m[2], 1, third, 'info')
      }
      continue
    }

    // Stylish file header: non-indented path-only line (after other patterns fail)
    const t = line.trim()
    const hasInlineLineCol = /\d+:\d+:/.test(t)
    if (!/^\s/.test(rawLine) && looksLikeFilePath(t) && !/\(\d+,\d+\)/.test(t) && !/\sline\s+\d+/i.test(t)) {
      const looksProblemish = /^\d+:\d+\s+(error|warning)\b/i.test(t)
      if (!looksProblemish && !hasInlineLineCol) {
        stylishFile = t
      }
      continue
    }

    stylishFile = ''
  }

  return out
}
