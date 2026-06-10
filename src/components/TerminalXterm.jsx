import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/** Interactive shell: node-pty when native module loads; otherwise piped cmd/bash + xterm */

function FallbackShell({ cwd, onAppendTaskOutput }) {
  const [history, setHistory] = useState('')
  const [cmd, setCmd] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const run = async () => {
    const c = cmd.trim()
    if (!c || !window.electron?.shellExec) return
    setCmd('')
    setHistory((h) => h + `${cwd || '.'}> ${c}\n`)
    const res = await window.electron.shellExec({ cwd: cwd || '', command: c })
    const out = (res.stdout || '') + (res.stderr ? `\n${res.stderr}` : '')
    setHistory((h) => h + out + (out.endsWith('\n') ? '' : '\n'))
    const body = `${out.trim() || '(no output)'}${res.ok ? '' : `\nexit ${res.code ?? '?'}`}`
    onAppendTaskOutput?.(`${cwd || '.'}> ${c}`, body)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}
    >
      <pre
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 10,
          margin: 0,
          color: 'var(--text-1)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.45,
        }}
      >
        {history || (
          <span style={{ color: 'var(--text-3)' }}>
            Electron-only terminal. Run the desktop app.
          </span>
        )}
        <span ref={bottomRef} />
      </pre>
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '6px 10px',
        display: 'flex',
        gap: 8,
        background: 'var(--bg-2)',
      }}
      >
        <span style={{ color: 'var(--accent-2)', flexShrink: 0 }}>$</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="One-shot command"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-0)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}
        />
      </div>
    </div>
  )
}

export default function TerminalXterm({ cwd, onAppendTaskOutput }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)

  useEffect(() => {
    if (!window.electron?.ptySpawn || !containerRef.current) return undefined

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      theme: {
        background: '#0a0a0c',
        foreground: '#e8e8f0',
        cursor: '#7c6af7',
        selectionBackground: 'rgba(124, 106, 247, 0.35)',
      },
      scrollback: 5000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    const unsubData = window.electron.onPtyData((d) => {
      term.write(d)
    })
    const unsubExit = window.electron.onPtyExit(() => {
      term.writeln('\r\n\x1b[33m[Shell session ended]\x1b[0m')
    })

    term.onData((data) => {
      window.electron.ptyWrite(data)
    })

    window.electron.ptySpawn({
      cwd: cwd || '',
      cols: term.cols,
      rows: term.rows,
    }).then(() => {})

    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      fit.fit()
      window.electron.ptyResize(term.cols, term.rows)
    })
    ro.observe(el)

    termRef.current = term

    return () => {
      ro.disconnect()
      unsubData?.()
      unsubExit?.()
      window.electron.ptyKill?.()
      term.dispose()
      termRef.current = null
    }
  }, [cwd])

  if (!window.electron?.ptySpawn) {
    return <FallbackShell cwd={cwd} onAppendTaskOutput={onAppendTaskOutput} />
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        minHeight: 0,
        padding: '4px 6px',
        overflow: 'hidden',
      }}
    />
  )
}
