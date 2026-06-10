import React from 'react'
import { GitBranch, Wifi, WifiOff } from 'lucide-react'
import { getLanguage } from '../utils/fileUtils'
import { getApiBase } from '../utils/aiApi'

export default function StatusBar({
  activeFile,
  agentOnline,
  cursorLine = 1,
  cursorColumn = 1,
  gitBranch,
}) {
  const apiHost = getApiBase().replace(/^https?:\/\//, '')

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      background: 'var(--bg-1)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 11 }}>
          {agentOnline
            ? <Wifi size={10} style={{ color: 'var(--green)' }} />
            : <WifiOff size={10} style={{ color: 'var(--red)' }} />}
          <span style={{ fontFamily: 'var(--font-mono)', color: agentOnline ? 'var(--text-2)' : 'var(--red)' }}>
            {apiHost}
          </span>
        </div>
        {gitBranch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)', fontSize: 11 }}>
            <GitBranch size={10} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{gitBranch}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-3)', fontSize: 11 }}>
        {activeFile && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              Ln {cursorLine}, Col {cursorColumn}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {getLanguage(activeFile.name)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              UTF-8
            </span>
          </>
        )}
        <span style={{ fontFamily: 'var(--font-mono)' }}>My AI Desktop</span>
      </div>
    </div>
  )
}
