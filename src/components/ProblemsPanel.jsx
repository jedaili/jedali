import React, { useMemo, useState } from 'react'
import { Play, Loader2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { parseLintDiagnostics } from '../utils/parseLintDiagnostics'

const sevColor = {
  error: 'var(--red)',
  warning: '#eab308',
  info: 'var(--text-3)',
}

export default function ProblemsPanel({
  text,
  diagnostics: diagnosticsProp,
  loading,
  onRunDiagnostics,
  hasWorkspace,
  workspaceRoot,
  onOpenDiagnostic,
  onRunTsc,
}) {
  const diagnostics = useMemo(() => {
    if (diagnosticsProp != null) return diagnosticsProp
    return parseLintDiagnostics(text || '', workspaceRoot)
  }, [diagnosticsProp, text, workspaceRoot])
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
    >
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
      >
        <button
          type="button"
          disabled={!hasWorkspace || loading}
          onClick={onRunDiagnostics}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: hasWorkspace && !loading ? 'var(--accent-dim)' : 'var(--bg-3)',
            color: hasWorkspace && !loading ? 'var(--text-0)' : 'var(--text-3)',
            fontSize: 11,
            fontWeight: 600,
            cursor: hasWorkspace && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
          Lint
        </button>
        {onRunTsc && (
          <button
            type="button"
            disabled={!hasWorkspace || loading}
            onClick={onRunTsc}
            title="tsc --noEmit via npx typescript"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: hasWorkspace && !loading ? 'var(--bg-3)' : 'var(--bg-3)',
              color: hasWorkspace && !loading ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 11,
              fontWeight: 600,
              cursor: hasWorkspace && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            tsc
          </button>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          Parsed locations open in the editor when possible.
        </span>
        {diagnostics.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-2)',
          }}
          >
            {diagnostics.length} issue{diagnostics.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {diagnostics.length > 0 && (
        <div style={{
          flex: 1,
          minHeight: 100,
          overflowY: 'auto',
          borderBottom: '1px solid var(--border)',
        }}
        >
          {diagnostics.map((d, i) => (
            <button
              key={`${d.path}-${d.line}-${d.column}-${i}`}
              type="button"
              onClick={() => onOpenDiagnostic?.(d.path, d.line, d.column)}
              title={d.path}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                cursor: onOpenDiagnostic ? 'pointer' : 'default',
                color: 'var(--text-1)',
              }}
              onMouseEnter={(e) => {
                if (onOpenDiagnostic) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}
              >
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: sevColor[d.severity] || sevColor.info,
                  flexShrink: 0,
                }}
                >
                  {d.severity}
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
                >
                  {d.path.replace(/\\/g, '/').split('/').pop()}
                  :
                  {d.line}
                  :
                  {d.column}
                </span>
                {onOpenDiagnostic && (
                  <ExternalLink size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                )}
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-2)' }}>
                {d.message}
              </div>
            </button>
          ))}
        </div>
      )}

      {(diagnostics.length > 0 || text) && (
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-3)',
            border: 'none',
            borderBottom: showRaw ? 'none' : '1px solid var(--border)',
            background: 'var(--bg-2)',
            cursor: 'pointer',
          }}
        >
          {showRaw ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Raw output
        </button>
      )}

      {showRaw && (
        <pre style={{
          flex: diagnostics.length > 0 ? 'none' : 1,
          flexGrow: 1,
          minHeight: 80,
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
          {text || (hasWorkspace
            ? 'No diagnostics yet. Run lint or open build output.'
            : 'Open a folder to run workspace checks.')}
        </pre>
      )}

      {!showRaw && diagnostics.length === 0 && (
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
          {text || (hasWorkspace
            ? 'No parsed locations yet — run lint or expand Raw output.'
            : 'Open a folder to run workspace checks.')}
        </pre>
      )}
    </div>
  )
}
