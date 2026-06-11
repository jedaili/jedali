import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, GitCommit, RotateCcw, PlusCircle, GitCompare, Sparkles, Upload, Loader2 } from 'lucide-react'
import { sendMessage } from '../utils/aiApi'

function resolveRepoPath(workspaceRoot, repoRelativePath) {
  const raw = String(repoRelativePath || '').trim()
  if (!raw || !workspaceRoot) return ''
  if (/^[A-Za-z]:[\\/]/i.test(raw) || raw.startsWith('/')) return raw
  const arrow = ' -> '
  const pathPart = raw.includes(arrow)
    ? raw.split(arrow).pop().trim()
    : raw
  const base = workspaceRoot.replace(/[/\\]+$/, '')
  const sep = navigator.platform.includes('Win') ? '\\' : '/'
  const rel = pathPart.replace(/\//g, sep)
  return `${base}${sep}${rel.replace(/^[/\\]+/, '')}`
}

function statusLabel(xy) {
  const x = xy[0] || ' '
  const y = xy[1] || ' '
  if (x === '?' || y === '?') return 'untracked'
  if (y === 'M' || x === 'M') return 'modified'
  if (y === 'A' || x === 'A') return 'added'
  if (y === 'D' || x === 'D') return 'deleted'
  if (x === 'R' || y === 'R') return 'renamed'
  return xy.trim() || 'changed'
}

export default function SourceControl({ workspaceRoot, onOpenFile, onOpenDiff }) {
  const [branch, setBranch] = useState(null)
  const [lines, setLines] = useState([])
  const [entries, setEntries] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (!workspaceRoot || !window.electron?.gitWorkspaceInfo) {
      setBranch(null)
      setLines([])
      setEntries([])
      setError('Open a folder')
      return
    }
    const res = await window.electron.gitWorkspaceInfo(workspaceRoot)
    setBranch(res.branch)
    setLines(res.statusLines || [])
    setEntries(Array.isArray(res.entries) ? res.entries : [])
    setError(res.error || null)
  }, [workspaceRoot])

  useEffect(() => {
    load()
  }, [load])

  const git = async (args, reload = true) => {
    if (!workspaceRoot || !window.electron?.gitExec) return
    setBusy(true)
    try {
      const r = await window.electron.gitExec({ cwd: workspaceRoot, args })
      if (!r.ok) {
        window.alert((r.stderr || r.stdout || 'Git command failed').slice(0, 1200))
      }
      if (reload) await load()
    } finally {
      setBusy(false)
    }
  }

  const stageAll = () => git(['add', '-A'])
  const discardPath = (relPath, xy) => {
    const untracked = xy.includes('?')
    const msg = untracked
      ? `Remove untracked file?\n${relPath}`
      : `Discard local changes?\n${relPath}`
    if (!window.confirm(msg)) return
    if (untracked) git(['clean', '-f', '--', relPath])
    else git(['checkout', '--', relPath])
  }
  const stagePath = (relPath) => git(['add', '--', relPath])

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      window.alert('Please enter a commit message.')
      return
    }
    await git(['commit', '-m', commitMessage.trim()])
    setCommitMessage('')
  }

  const handlePush = () => git(['push'])

  const generateCommitMessage = async () => {
    if (!workspaceRoot || !window.electron?.gitExec) return
    setGenerating(true)
    try {
      const r = await window.electron.gitExec({ cwd: workspaceRoot, args: ['diff', '--staged'] })
      if (!r.ok || !r.stdout.trim()) {
        window.alert('No staged changes found to generate a message for.')
        return
      }

      const diff = r.stdout.slice(0, 4000)
      const systemPrompt = `You are an expert developer. Generate a concise, professional Git commit message for the following staged diff.
Only output the raw commit message without any markdown formatting, prefixes, quotes, or conversational text. Use the imperative mood (e.g. "Add feature" not "Added feature").

Diff:
${diff}`

      const response = await sendMessage([{ role: 'user', content: systemPrompt }])
      if (response) {
        let clean = response.replace(/^["'`]|["'`]$/g, '').trim()
        if (clean.startsWith('```')) {
          clean = clean.split('\n').slice(1, -1).join('\n').trim()
        }
        setCommitMessage(clean)
      }
    } catch (e) {
      window.alert('Failed to generate commit message: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}
    >
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--text-2)',
          textTransform: 'uppercase',
        }}
        >
          Source Control
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            title="Push"
            disabled={busy}
            onClick={handlePush}
            style={{ color: 'var(--text-2)', padding: 4, background: 'transparent', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <Upload size={13} />
          </button>
          <button
            type="button"
            title="Refresh"
            disabled={busy}
            onClick={load}
            style={{ color: 'var(--text-2)', padding: 4, background: 'transparent', border: 'none', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        flexShrink: 0,
      }}
      >
        <button
          type="button"
          disabled={busy || !workspaceRoot || !!error}
          onClick={stageAll}
          title="git add -A"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-3)',
            color: 'var(--text-1)',
            cursor: busy ? 'not-allowed' : 'pointer',
            flex: 1,
            justifyContent: 'center'
          }}
        >
          <PlusCircle size={12} /> Stage all
        </button>
        
        <div style={{ width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={busy || generating}
            rows={3}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-0)',
              outline: 'none',
              resize: 'vertical',
              minHeight: 50,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              disabled={busy || generating || !workspaceRoot}
              onClick={generateCommitMessage}
              title="Generate commit message with AI"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 10px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(124, 106, 247, 0.35)',
                background: 'rgba(124, 106, 247, 0.1)',
                color: 'var(--accent)',
                cursor: (busy || generating) ? 'not-allowed' : 'pointer',
                flex: 1,
              }}
            >
              {generating ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
              Generate
            </button>
            <button
              type="button"
              disabled={busy || !workspaceRoot || !commitMessage.trim()}
              onClick={handleCommit}
              title="Commit staged changes"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 10px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: (busy || !commitMessage.trim()) ? 'not-allowed' : 'pointer',
                flex: 1,
              }}
            >
              <GitCommit size={12} /> Commit
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
        {branch && (
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
            marginBottom: 12,
          }}
          >
            Branch: {branch}
          </div>
        )}
        {error && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
            {error}
          </p>
        )}

        {entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((e, idx) => {
              const abs = resolveRepoPath(workspaceRoot, e.path)
              const label = statusLabel(e.xy)
              return (
                <div
                  key={`${idx}-${e.xy}-${e.path}`}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-2)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => abs && onOpenFile?.(abs)}
                    title={e.path}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: onOpenFile ? 'pointer' : 'default',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: label === 'untracked' ? 'var(--accent-2)' : 'var(--text-2)',
                      marginRight: 8,
                    }}
                    >
                      {e.xy.trim()}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-0)',
                      wordBreak: 'break-word',
                    }}
                    >
                      {e.path}
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {onOpenDiff && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onOpenDiff(e.path, e.xy)}
                        title="HEAD vs working tree"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: 'var(--accent-dim)',
                          color: 'var(--text-0)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <GitCompare size={10} />
                        Diff
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => stagePath(e.path)}
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-3)',
                        color: 'var(--text-1)',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Stage
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => discardPath(e.path, e.xy)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid rgba(248,113,113,0.35)',
                        background: 'transparent',
                        color: 'var(--red)',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <RotateCcw size={10} />
                      Discard
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {entries.length === 0 && !error && branch && (
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Working tree clean.</p>
        )}

        {lines.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{
              fontSize: 10,
              color: 'var(--text-3)',
              cursor: 'pointer',
              marginBottom: 8,
            }}
            >
              git status -sb (raw)
            </summary>
            <pre style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-2)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}
            >
              {lines.join('\n')}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
