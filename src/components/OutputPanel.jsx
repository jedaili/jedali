import React from 'react'
import { Trash2 } from 'lucide-react'

export default function OutputPanel({ text, onClear }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
    >
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
          Task / diagnostic output
        </span>
        <button
          type="button"
          title="Clear output"
          onClick={onClear}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 10,
            color: 'var(--text-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-3)',
          }}
        >
          <Trash2 size={11} /> Clear
        </button>
      </div>
      <pre style={{
        flex: 1,
        overflow: 'auto',
        margin: 0,
        padding: 12,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.45,
        color: 'var(--text-2)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      >
        {text || 'Output from lint and future tasks will appear here.'}
      </pre>
    </div>
  )
}
