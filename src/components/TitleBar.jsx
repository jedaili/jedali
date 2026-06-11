import React from 'react'
import { Minus, Square, X, Bot, Keyboard, Zap } from 'lucide-react'

export default function TitleBar({ agentOnline, onOpenShortcuts }) {
  const isElectron = !!window.electron

  return (
    <div style={{
      height: 'var(--titlebar-height)',
      background: 'linear-gradient(90deg, var(--bg-1) 0%, rgba(14,14,18,0.97) 100%)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      WebkitAppRegion: 'drag',
      flexShrink: 0,
      paddingLeft: 12,
      paddingRight: 0,
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Subtle accent line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 50%, transparent 100%)',
        opacity: 0.5,
      }} />

      {/* Left: Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(124,106,247,0.35)',
        }}>
          <Bot size={13} color="#fff" />
        </div>
        <span style={{
          fontWeight: 700, fontSize: 13, letterSpacing: '0.03em',
          color: 'var(--text-0)',
          background: 'linear-gradient(90deg, #eaeaf5, #a9a9be)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          My AI Desktop
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: agentOnline ? 'var(--green)' : 'var(--red)',
          background: agentOnline ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
          padding: '2px 7px 2px 5px', borderRadius: 99,
          border: `1px solid ${agentOnline ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: agentOnline ? 'var(--green)' : 'var(--red)',
            display: 'inline-block',
            animation: agentOnline ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          {agentOnline ? 'online' : 'offline'}
        </div>
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
            color: 'var(--text-3)',
            borderRadius: 'var(--radius-sm)',
            marginRight: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-4)'
            e.currentTarget.style.color = 'var(--text-0)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-3)'
          }}
        >
          <Keyboard size={15} />
        </button>
      )}

      {isElectron && (
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', alignItems: 'center' }}>
          {[
            { icon: <Minus size={12} />, action: window.electron.minimize, danger: false },
            { icon: <Square size={11} />, action: window.electron.maximize, danger: false },
            { icon: <X size={12} />, action: window.electron.close, danger: true },
          ].map(({ icon, action, danger }, i) => (
            <button
              key={i}
              onClick={action}
              style={{
                width: 46, height: 38, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = danger ? 'var(--red)' : 'var(--bg-3)'
                e.currentTarget.style.color = danger ? '#fff' : 'var(--text-0)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-3)'
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
