import React, { useState, useCallback } from 'react'
import { Search } from 'lucide-react'

export default function WorkspaceSearch({
  roots,
  onOpenResult,
}) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState([])
  const [truncated, setTruncated] = useState(false)

  const run = useCallback(async () => {
    const q = query.trim()
    if (!q || !roots?.length || !window.electron?.searchInWorkspace) {
      setMatches([])
      return
    }
    setLoading(true)
    try {
      const res = await window.electron.searchInWorkspace({
        roots,
        query: q,
        maxResults: 250,
      })
      setMatches(res.matches || [])
      setTruncated(!!res.truncated)
    } catch (e) {
      setMatches([])
      setTruncated(false)
    } finally {
      setLoading(false)
    }
  }, [query, roots])

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--text-2)',
          textTransform: 'uppercase',
        }}>
          Search
        </span>
      </div>

      <div style={{ padding: 10, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Search across workspace…"
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-0)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={run}
            disabled={loading || !roots?.length}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              opacity: loading || !roots?.length ? 0.5 : 1,
            }}
          >
            <Search size={14} style={{ display: 'block' }} />
          </button>
        </div>
        {!roots?.length && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Open a folder first to search.
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', fontSize: 11 }}>
        {truncated && (
          <div style={{ padding: '6px 10px', color: 'var(--yellow)', fontSize: 10 }}>
            Results truncated — narrow your query.
          </div>
        )}
        {matches.map((m, i) => (
          <button
            key={`${m.path}:${m.line}:${i}`}
            type="button"
            onClick={() => onOpenResult?.(m)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-1)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              fontSize: 10,
              color: 'var(--accent-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 4,
            }}>
              {m.path.replace(/\\/g, '/')}:{m.line}
            </div>
            <div style={{ color: 'var(--text-2)', wordBreak: 'break-word' }}>
              {m.preview}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
