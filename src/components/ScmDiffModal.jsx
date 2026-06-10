import React from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { X } from 'lucide-react'

export default function ScmDiffModal({
  open,
  title,
  original = '',
  modified = '',
  language = 'plaintext',
  onClose,
}) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="scm-diff-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: 'rgba(0,0,0,0.6)',
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
          width: 'min(1100px, 98vw)',
          height: 'min(760px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2)',
        }}
        >
          <div style={{ minWidth: 0 }}>
            <span id="scm-diff-title" style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-0)',
            }}
            >
              SCM diff
            </span>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            >
              {title}
            </div>
          </div>
          <button
            type="button"
            title="Close (Esc)"
            onClick={onClose}
            style={{
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <DiffEditor
            height="100%"
            theme="vs-dark"
            language={language}
            original={original}
            modified={modified}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
            }}
          />
        </div>
        <div style={{
          flexShrink: 0,
          padding: '8px 14px',
          fontSize: 10,
          color: 'var(--text-3)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-2)',
        }}
        >
          Left: last committed (HEAD). Right: working tree. Read-only — close to return.
        </div>
      </div>
    </div>
  )
}
