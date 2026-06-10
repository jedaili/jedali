import React from 'react'
import { Files, Search, GitBranch, Terminal, AlertCircle, FileOutput } from 'lucide-react'

const btn = (active) => ({
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
  background: active ? 'rgba(124,106,247,0.08)' : 'transparent',
  color: active ? 'var(--text-0)' : 'var(--text-3)',
  cursor: 'pointer',
  transition: 'var(--transition)',
})

/** VS Code–style narrow activity rail */
export default function ActivityBar({
  activeView,
  onViewChange,
  bottomOpen,
  bottomTab,
  onToggleTerminal,
  onToggleProblems,
  onToggleOutput,
  problemsCount = 0,
}) {
  const Item = ({ id, title, icon: Icon }) => (
    <button
      type="button"
      title={title}
      style={btn(activeView === id)}
      onClick={() => onViewChange(id)}
      onMouseEnter={(e) => {
        if (activeView !== id) {
          e.currentTarget.style.color = 'var(--text-1)'
        }
      }}
      onMouseLeave={(e) => {
        if (activeView !== id) {
          e.currentTarget.style.color = 'var(--text-3)'
        }
      }}
    >
      <Icon size={20} strokeWidth={1.75} />
    </button>
  )

  return (
    <div
      style={{
        width: 'var(--activity-width)',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        flexShrink: 0,
        paddingTop: 6,
        gap: 2,
      }}
    >
      <Item id="explorer" title="Explorer (Ctrl+Shift+E)" icon={Files} />
      <Item id="search" title="Search in Files (Ctrl+Shift+F)" icon={Search} />
      <Item id="scm" title="Source Control (Ctrl+Shift+G)" icon={GitBranch} />

      <div style={{ flex: 1 }} />

      <button
        type="button"
        title={problemsCount > 0 ? `Problems (${problemsCount})` : 'Problems'}
        style={{
          ...btn(bottomOpen && bottomTab === 'problems'),
          position: 'relative',
        }}
        onClick={onToggleProblems}
      >
        <AlertCircle size={20} strokeWidth={1.75} />
        {problemsCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 14,
            height: 14,
            padding: '0 4px',
            borderRadius: 7,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: '14px',
            textAlign: 'center',
            background: 'var(--red)',
            color: '#fff',
            pointerEvents: 'none',
          }}
          >
            {problemsCount > 99 ? '99+' : problemsCount}
          </span>
        )}
      </button>
      <button
        type="button"
        title="Output"
        style={btn(bottomOpen && bottomTab === 'output')}
        onClick={onToggleOutput}
      >
        <FileOutput size={20} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        title="Terminal (Ctrl+`)"
        style={btn(bottomOpen && bottomTab === 'terminal')}
        onClick={onToggleTerminal}
      >
        <Terminal size={20} strokeWidth={1.75} />
      </button>
    </div>
  )
}
