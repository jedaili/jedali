import React, { useEffect, useRef, useState, useMemo } from 'react'

export default function QuickOpen({ open, onClose, roots, onPick }) {
  const [filter, setFilter] = useState('')
  const [files, setFiles] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open || !roots?.length || !window.electron?.listWorkspaceFiles) {
      setFiles([])
      return
    }
    let cancelled = false
    ;(async () => {
      const list = await window.electron.listWorkspaceFiles(roots)
      if (!cancelled) setFiles(list || [])
    })()
    return () => { cancelled = true }
  }, [open, roots])

  useEffect(() => {
    if (open) {
      setFilter('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const paths = files.map((f) => f.path || f.label || '')
    if (!q) return paths.slice(0, 80)
    return paths.filter((p) => p.toLowerCase().includes(q)).slice(0, 80)
  }, [files, filter])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200001,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Go to file…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            fontSize: 14,
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-3)',
            color: 'var(--text-0)',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPick(p)
                onClose()
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-1)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              title={p}
            >
              {p.replace(/\\/g, '/')}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 12 }}>
              {roots?.length ? 'No matches.' : 'Open a folder first.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
