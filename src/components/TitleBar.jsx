import React from 'react'
import { Minus, Square, X, Bot, Keyboard } from 'lucide-react'

export default function TitleBar({ agentOnline, onOpenShortcuts }) {
  const isElectron = !!window.electron

  return (
    <div style={{
      height: 'var(--titlebar-height)',
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      WebkitAppRegion: 'drag',
      flexShrink: 0,
      paddingLeft: 12,
      paddingRight: 0,
      userSelect: 'none',
    }}>
      {/* Left: Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={13} color="#fff" />
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.02em', color: 'var(--text-0)' }}>
          My AI Desktop
        </span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: agentOnline ? 'var(--green)' : 'var(--red)',
          background: agentOnline ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          padding: '2px 7px', borderRadius: 99,
          border: `1px solid ${agentOnline ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
        }}>
          {agentOnline ? '● agent online' : '○ agent offline'}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {onOpenShortcuts && (
        <button
          type="button"
          title="Keyboard shortcuts"
          onClick={onOpenShortcuts}
          style={{
            WebkitAppRegion: 'no-drag',
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            transition: 'var(--transition)',
            marginRight: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-4)'
            e.currentTarget.style.color = 'var(--text-0)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-2)'
          }}
        >
          <Keyboard size={15} />
        </button>
      )}

      {isElectron && (
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', alignItems: 'center' }}>
          {[
            { icon: <Minus size={12} />, action: window.electron.minimize, hover: 'var(--bg-4)' },
            { icon: <Square size={11} />, action: window.electron.maximize, hover: 'var(--bg-4)' },
            { icon: <X size={12} />, action: window.electron.close, hover: 'var(--red)', danger: true },
          ].map(({ icon, action, danger }, i) => (
            <button
              key={i}
              onClick={action}
              style={{
                width: 46, height: 38, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-2)', transition: 'var(--transition)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = danger ? 'var(--red)' : 'var(--bg-4)'
                if (danger) e.currentTarget.style.color = '#fff'
                else e.currentTarget.style.color = 'var(--text-0)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-2)'
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
