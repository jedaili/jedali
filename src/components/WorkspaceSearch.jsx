import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Search, Replace, ChevronDown, ChevronRight, CaseSensitive, Regex, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.cache'])

function HighlightedLine({ preview, matchStart, matchLength }) {
  if (matchStart == null || matchLength == null) {
    return <span style={{ color: 'var(--text-2)' }}>{preview}</span>
  }
  const before = preview.slice(0, matchStart)
  const match = preview.slice(matchStart, matchStart + matchLength)
  const after = preview.slice(matchStart + matchLength)
  const maxBefore = 30
  const trimmedBefore = before.length > maxBefore ? '…' + before.slice(-maxBefore) : before

  return (
    <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
      {trimmedBefore}
      <mark style={{
        background: 'rgba(255, 213, 79, 0.35)',
        color: 'var(--text-0)',
        borderRadius: 2,
        padding: '0 1px',
      }}>
        {match}
      </mark>
      {after.slice(0, 80)}
    </span>
  )
}

function FileGroup({ filePath, matches, onOpenResult, workspaceRoots }) {
  const [collapsed, setCollapsed] = useState(false)

  const displayPath = useMemo(() => {
    let p = filePath.replace(/\\/g, '/')
    for (const r of (workspaceRoots || [])) {
      const rn = r.replace(/\\/g, '/').replace(/\/$/, '')
      if (p.startsWith(rn + '/')) {
        p = p.slice(rn.length + 1)
        break
      }
    }
    return p
  }, [filePath, workspaceRoots])

  const fileName = displayPath.split('/').pop()
  const dirPath = displayPath.includes('/') ? displayPath.slice(0, displayPath.lastIndexOf('/')) : ''

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', textAlign: 'left', padding: '5px 10px',
          background: 'var(--bg-2)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          color: 'var(--text-1)', fontSize: 11,
          position: 'sticky', top: 0, zIndex: 1,
        }}
      >
        {collapsed
          ? <ChevronRight size={12} style={{ flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ flexShrink: 0 }} />}
        <FileText size={12} style={{ flexShrink: 0, color: 'var(--accent-2)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-0)', flexShrink: 0 }}>{fileName}</span>
        {dirPath && (
          <span style={{
            color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', minWidth: 0,
          }}>
            &nbsp;{dirPath}
          </span>
        )}
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: 10, background: 'var(--bg-4)',
          padding: '1px 6px', borderRadius: 99, color: 'var(--text-2)',
        }}>
          {matches.length}
        </span>
      </button>

      {!collapsed && matches.map((m, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpenResult(m)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '5px 10px 5px 28px', border: 'none',
            background: 'transparent', cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 28, textAlign: 'right',
            }}>
              {m.line}
            </span>
            <span style={{ fontSize: 11, overflow: 'hidden', display: 'block', width: '100%' }}>
              <HighlightedLine
                preview={m.preview}
                matchStart={m.matchStart}
                matchLength={m.matchLength}
              />
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

export default function WorkspaceSearch({ roots, onOpenResult, onReplaceFile }) {
  const [query, setQuery] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [loading, setLoading] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [matches, setMatches] = useState([])
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState(null)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [fileFilter, setFileFilter] = useState('')
  const [replaceResult, setReplaceResult] = useState(null)

  const queryRef = useRef(query)
  queryRef.current = query

  // Group matches by file path
  const grouped = useMemo(() => {
    const map = new Map()
    for (const m of matches) {
      if (!map.has(m.path)) map.set(m.path, [])
      map.get(m.path).push(m)
    }
    return [...map.entries()]
  }, [matches])

  const run = useCallback(async () => {
    const q = query.trim()
    if (!q || !roots?.length || !window.electron?.searchInWorkspace) {
      setMatches([])
      return
    }
    setLoading(true)
    setError(null)
    setReplaceResult(null)
    try {
      const res = await window.electron.searchInWorkspace({
        roots,
        query: q,
        maxResults: 300,
        useRegex,
        caseSensitive,
        fileFilter,
      })
      if (res.error) {
        setError(res.error)
        setMatches([])
      } else {
        setMatches(res.matches || [])
        setTruncated(!!res.truncated)
      }
    } catch (e) {
      setError(e.message || String(e))
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [query, roots, useRegex, caseSensitive, fileFilter])

  const runReplaceAll = useCallback(async () => {
    if (!replaceOpen || !query.trim() || !grouped.length) return
    setReplacing(true)
    setReplaceResult(null)
    let totalCount = 0
    let failedFiles = []

    for (const [filePath] of grouped) {
      try {
        const res = await window.electron.replaceInFile({
          filePath,
          query: query.trim(),
          replacement: replaceText,
          useRegex,
          caseSensitive,
        })
        if (res.ok) {
          totalCount += res.count
          // Notify parent to reload the file if it's open
          onReplaceFile?.(filePath)
        } else {
          failedFiles.push(filePath)
        }
      } catch (e) {
        failedFiles.push(filePath)
      }
    }

    setReplaceResult({
      ok: failedFiles.length === 0,
      message: failedFiles.length === 0
        ? `Replaced ${totalCount} occurrence(s) across ${grouped.length} file(s).`
        : `Replaced in ${grouped.length - failedFiles.length} file(s). ${failedFiles.length} failed.`
    })
    setReplacing(false)
    // Re-run search to reflect new state
    await run()
  }, [grouped, query, replaceText, useRegex, caseSensitive, run, replaceOpen, onReplaceFile])

  // Ctrl+Shift+F shortcut focus
  const inputRef = useRef(null)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleBtnStyle = (active) => ({
    padding: '3px 7px', borderRadius: 'var(--radius-sm)', border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'rgba(124,106,247,0.18)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-2)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 11,
  })

  return (
    <div style={{
      width: 'var(--sidebar-width)', background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center',
        padding: '0 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase', flex: 1 }}>
          Search
        </span>
        <button
          type="button"
          title="Toggle Replace"
          onClick={() => setReplaceOpen(o => !o)}
          style={{
            ...toggleBtnStyle(replaceOpen),
            fontSize: 10, gap: 4,
          }}
        >
          <Replace size={11} />
          Replace
        </button>
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Search Input */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="Search (Enter to run)…"
              style={{
                width: '100%', padding: '7px 8px 7px 26px', fontSize: 12,
                fontFamily: 'var(--font-mono)', background: 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="button"
            title={caseSensitive ? 'Case Sensitive (ON)' : 'Case Sensitive (OFF)'}
            onClick={() => setCaseSensitive(v => !v)}
            style={toggleBtnStyle(caseSensitive)}
          >
            <CaseSensitive size={13} />
          </button>
          <button
            type="button"
            title={useRegex ? 'Regex (ON)' : 'Use Regex'}
            onClick={() => setUseRegex(v => !v)}
            style={toggleBtnStyle(useRegex)}
          >
            <Regex size={13} />
          </button>
        </div>

        {/* Replace Input */}
        {replaceOpen && (
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Replace size={12} style={{ position: 'absolute', left: 8, color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runReplaceAll()}
                placeholder="Replace with…"
                style={{
                  width: '100%', padding: '7px 8px 7px 26px', fontSize: 12,
                  fontFamily: 'var(--font-mono)', background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="button"
              onClick={runReplaceAll}
              disabled={replacing || !query.trim() || !grouped.length}
              title="Replace All"
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: replacing || !query.trim() || !grouped.length ? 'var(--bg-4)' : 'var(--accent)',
                color: replacing || !query.trim() || !grouped.length ? 'var(--text-3)' : '#fff',
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              {replacing ? <Loader2 size={12} className="spin" /> : <Replace size={12} />}
              All
            </button>
          </div>
        )}

        {/* File Filter */}
        <input
          type="text"
          value={fileFilter}
          onChange={e => setFileFilter(e.target.value)}
          placeholder="Filter by type: *.js, *.py"
          style={{
            width: '100%', padding: '5px 8px', fontSize: 11,
            fontFamily: 'var(--font-mono)', background: 'var(--bg-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-0)', outline: 'none', boxSizing: 'border-box',
          }}
        />

        {!roots?.length && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, marginTop: 2 }}>
            Open a folder first to search.
          </p>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', fontSize: 11, position: 'relative' }}>
        {/* Status bar */}
        {(error || truncated || replaceResult || (!loading && matches.length > 0)) && (
          <div style={{
            padding: '5px 10px', fontSize: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 5,
            borderBottom: '1px solid var(--border)',
            background: replaceResult
              ? (replaceResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)')
              : error ? 'rgba(248,113,113,0.08)' : 'transparent',
            color: replaceResult
              ? (replaceResult.ok ? 'var(--green)' : 'var(--red)')
              : error ? 'var(--red)' : 'var(--text-2)',
          }}>
            {replaceResult
              ? (replaceResult.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />)
              : error ? <AlertCircle size={11} /> : null}
            <span>{replaceResult?.message || error || `${matches.length} result(s) in ${grouped.length} file(s)${truncated ? ' — truncated' : ''}`}</span>
          </div>
        )}

        {loading && (
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
            <Loader2 size={14} className="spin" />
            Searching…
          </div>
        )}

        {!loading && grouped.map(([filePath, fileMatches]) => (
          <FileGroup
            key={filePath}
            filePath={filePath}
            matches={fileMatches}
            onOpenResult={onOpenResult}
            workspaceRoots={roots}
          />
        ))}

        {!loading && !error && query.trim() && matches.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
            No results for <code style={{ fontFamily: 'var(--font-mono)' }}>"{query}"</code>
          </div>
        )}
      </div>
    </div>
  )
}
