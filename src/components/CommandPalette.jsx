import React, { useEffect, useRef, useState, useMemo } from 'react'

export default function CommandPalette({ open, onClose, commands }) {
  const [filter, setFilter] = useState('')
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, filter])

  useEffect(() => {
    if (open) {
      setFilter('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

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
        zIndex: 200000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 92vw)',
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
          placeholder="Type a command…"
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
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                c.run()
                onClose()
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-1)',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {c.label}
              {c.detail && (
                <span style={{ float: 'right', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {c.detail}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 12 }}>No matching commands.</div>
          )}
        </div>
      </div>
    </div>
  )
}
