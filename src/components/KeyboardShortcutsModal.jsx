import React from 'react'
import { X } from 'lucide-react'

const ROWS = [
  ['Command Palette', 'Ctrl+Shift+P'],
  ['Go to File', 'Ctrl+P'],
  ['Save', 'Ctrl+S'],
  ['Format document', 'Shift+Alt+F'],
  ['Close Editor Tab', 'Ctrl+W'],
  ['Toggle Terminal', 'Ctrl+`'],
  ['Toggle Output', 'Ctrl+Shift+U'],
  ['Split / Join Editor', 'Ctrl+\\'],
  ['Reveal Active File in Explorer', 'Alt+R'],
  ['Explorer', 'Ctrl+Shift+E'],
  ['Search in Files', 'Ctrl+Shift+F'],
  ['Source Control', 'Ctrl+Shift+G'],
  ['Find in File (Monaco)', 'Ctrl+F'],
  ['Accept Inline Completion', 'Tab'],
  ['Accept Inline Completion Word', 'Ctrl+RightArrow'],
]

export default function KeyboardShortcutsModal({ open, onClose }) {
  if (!open) return null

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 190000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          maxHeight: 'min(72vh, 520px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
        >
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-0)' }}>
            Keyboard shortcuts
          </span>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {ROWS.map(([label, keys]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '8px 16px',
                fontSize: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--text-1)' }}>{label}</span>
              <kbd style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                color: 'var(--accent-2)',
                whiteSpace: 'nowrap',
              }}
              >
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
