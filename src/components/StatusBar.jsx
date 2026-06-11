import React from 'react'
import { GitBranch, Wifi, WifiOff, Cpu } from 'lucide-react'
import { getLanguage } from '../utils/fileUtils'
import { getActiveProvider } from '../utils/modelProviders'

const PROVIDER_TYPE_ICONS = {
  local: '🏠',
  ollama: '🦙',
  openai: '🤖',
  anthropic: '🎭',
  gemini: '✨',
}

export default function StatusBar({
  activeFile,
  agentOnline,
  cursorLine = 1,
  cursorColumn = 1,
  gitBranch,
}) {
  const provider = getActiveProvider()
  const providerLabel = provider
    ? `${PROVIDER_TYPE_ICONS[provider.type] || '🔌'} ${provider.modelName ? `${provider.modelName}` : provider.name}`
    : 'No Provider'

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      background: 'var(--bg-1)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px',
      flexShrink: 0,
      fontSize: 11,
      gap: 4,
    }}>
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {/* Agent/Provider status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '1px 7px',
          borderRadius: 3,
          background: agentOnline ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)',
          border: `1px solid ${agentOnline ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
        }}>
          {agentOnline
            ? <Wifi size={9} style={{ color: 'var(--green)' }} />
            : <WifiOff size={9} style={{ color: 'var(--red)' }} />}
          <span style={{
            fontFamily: 'var(--font-mono)',
            color: agentOnline ? 'var(--text-2)' : 'var(--red)',
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {providerLabel}
          </span>
        </div>

        {/* Git branch */}
        {gitBranch && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: 'var(--text-2)',
          }}>
            <GitBranch size={10} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{gitBranch}</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-3)' }}>
        {activeFile && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              Ln {cursorLine}, Col {cursorColumn}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-2)',
              background: 'var(--accent-2-dim)',
              padding: '1px 6px',
              borderRadius: 3,
            }}>
              {getLanguage(activeFile.name)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              UTF-8
            </span>
          </>
        )}
        <span style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)',
          opacity: 0.6,
        }}>
          My AI Desktop
        </span>
      </div>
    </div>
  )
}
