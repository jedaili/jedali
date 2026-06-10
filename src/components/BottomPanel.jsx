import React from 'react'
import { Terminal, FileOutput, AlertCircle } from 'lucide-react'
import TerminalXterm from './TerminalXterm'
import ProblemsPanel from './ProblemsPanel'
import OutputPanel from './OutputPanel'

export default function BottomPanel({
  tab,
  onTabChange,
  terminalCwd,
  problemsText,
  diagnosticsLoading,
  onRunDiagnostics,
  hasWorkspace,
  problemsWorkspaceRoot,
  diagnostics,
  problemsCount,
  onOpenDiagnostic,
  onRunTsc,
  outputText,
  onClearOutput,
  onTerminalTaskOutput,
}) {
  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'output', label: 'Output', icon: FileOutput },
    {
      id: 'problems',
      label: typeof problemsCount === 'number' && problemsCount > 0
        ? `Problems (${problemsCount})`
        : 'Problems',
      icon: AlertCircle,
    },
  ]

  return (
    <div style={{
      height: 'var(--bottom-panel-height)',
      minHeight: 120,
      background: 'var(--bg-1)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        height: 30,
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              fontSize: 11,
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--text-0)' : 'var(--text-3)',
              border: 'none',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>
      <div style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      >
        {tab === 'terminal' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <TerminalXterm cwd={terminalCwd} onAppendTaskOutput={onTerminalTaskOutput} />
          </div>
        )}
        {tab === 'output' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <OutputPanel text={outputText} onClear={onClearOutput} />
          </div>
        )}
        {tab === 'problems' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ProblemsPanel
              text={problemsText}
              diagnostics={diagnostics}
              loading={diagnosticsLoading}
              onRunDiagnostics={onRunDiagnostics}
              hasWorkspace={hasWorkspace}
              workspaceRoot={problemsWorkspaceRoot}
              onOpenDiagnostic={onOpenDiagnostic}
              onRunTsc={onRunTsc}
            />
          </div>
        )}
      </div>
    </div>
  )
}
