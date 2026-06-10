import React, { useEffect, useRef, useState, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { X, Save, FileText, Columns2 } from 'lucide-react'
import { getLanguage, getFileIcon } from '../utils/fileUtils'
import { normPathKey } from '../utils/pathNorm'

const PROBLEM_MARKER_OWNER = 'my-ai-desktop-problems'

function applyProblemMarkers(monaco, editor, diagnostics, filePath) {
  if (!monaco?.editor || !editor?.getModel) return
  const model = editor.getModel()
  if (!model) return
  const fp = normPathKey(filePath)
  const list = (diagnostics || []).filter((d) => normPathKey(d.path) === fp)
  const markers = list.map((d) => {
    const line = Math.max(1, Number(d.line) || 1)
    const col = Math.max(1, Number(d.column) || 1)
    const sev =
      d.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : d.severity === 'info'
          ? monaco.MarkerSeverity.Info
          : monaco.MarkerSeverity.Error
    return {
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: col + 1,
      message: d.message || '',
      severity: sev,
    }
  })
  monaco.editor.setModelMarkers(model, PROBLEM_MARKER_OWNER, markers)
}

function breadcrumbSegments(filePath, workspaceRoots) {
  if (!filePath) return []
  const norm = (p) => String(p || '').replace(/\\/g, '/').toLowerCase()
  const fp = norm(filePath)
  let bestRoot = ''
  for (const r of workspaceRoots || []) {
    const rn = norm(r).replace(/\/$/, '')
    if (!rn) continue
    if ((fp === rn || fp.startsWith(`${rn}/`)) && rn.length > bestRoot.length) {
      bestRoot = r
    }
  }
  const parts = filePath.split(/[/\\]/).filter(Boolean)
  if (!bestRoot) {
    return parts.map((label, i) => ({
      label,
      last: i === parts.length - 1,
    }))
  }
  const rootNorm = norm(bestRoot).replace(/\/$/, '')
  const suffix = fp.slice(rootNorm.length).replace(/^\//, '')
  const segs = suffix.split('/').filter(Boolean)
  return segs.map((label, i) => ({
    label,
    last: i === segs.length - 1,
  }))
}

const baseEditorOptions = (minimapEnabled) => ({
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
  fontLigatures: true,
  lineHeight: 1.7,
  minimap: { enabled: minimapEnabled },
  scrollBeyondLastLine: false,
  renderWhitespace: 'selection',
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,
  padding: { top: 16, bottom: 16 },
  bracketPairColorization: { enabled: true },
  guides: { indentation: true, bracketPairs: true },
  renderLineHighlight: 'line',
  occurrencesHighlight: true,
  suggest: { preview: true },
  wordWrap: 'off',
  tabSize: 2,
  formatOnPaste: true,
  automaticLayout: true,
  quickSuggestions: true,
  folding: true,
  foldingStrategy: 'indentation',
  mouseWheelZoom: true,
})

function BreadcrumbBar({ filePath, workspaceRoots }) {
  const segs = breadcrumbSegments(filePath, workspaceRoots)
  if (!segs.length) return null
  return (
    <div style={{
      flexShrink: 0,
      padding: '6px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-2)',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-3)',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
    >
      {segs.map((seg, i) => (
        <span key={`${seg.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
          <span style={{ color: seg.last ? 'var(--accent-2)' : 'var(--text-2)' }}>{seg.label}</span>
        </span>
      ))}
    </div>
  )
}

export default function EditorArea({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onSave,
  onContentChange,
  onCursorPositionChange,
  minimapEnabled = true,
  revealRequest,
  onRevealHandled,
  workspaceRoots = [],
  splitEditor = false,
  secondaryTabPath = null,
  onSecondaryTabPathChange,
  onToggleSplit,
  diagnostics = [],
}) {
  const [saving, setSaving] = useState(false)
  const primaryRef = useRef(null)
  const secondaryEditorRef = useRef(null)
  const monacoRef = useRef(null)
  const activeFileRef = useRef(null)
  const onContentChangeRef = useRef(onContentChange)

  const activeFile = tabs.find((t) => t.path === activeTab)
  const secondaryFile = tabs.find((t) => t.path === secondaryTabPath)

  activeFileRef.current = activeFile
  onContentChangeRef.current = onContentChange

  const editorOpts = useMemo(() => baseEditorOptions(minimapEnabled), [minimapEnabled])

  const handleSave = async () => {
    if (!activeFile || !activeFile.dirty) return
    setSaving(true)
    await onSave(activeFile.path, activeFile.content)
    setTimeout(() => setSaving(false), 600)
  }

  const handlePrimaryMount = (editor, monaco) => {
    primaryRef.current = editor
    monacoRef.current = monaco
    editor.onDidChangeCursorPosition((e) => {
      onCursorPositionChange?.({
        line: e.position.lineNumber,
        column: e.position.column,
      })
    })
  }

  const handleSecondaryMount = (editor, monaco) => {
    secondaryEditorRef.current = editor
    monacoRef.current = monaco
  }

  useEffect(() => {
    const monaco = monacoRef.current
    const primaryEd = primaryRef.current
    if (!monaco?.editor || !primaryEd?.getModel) return
    if (activeFile) {
      applyProblemMarkers(monaco, primaryEd, diagnostics, activeFile.path)
    } else {
      monaco.editor.setModelMarkers(primaryEd.getModel(), PROBLEM_MARKER_OWNER, [])
    }
    const sec = secondaryEditorRef.current
    const splitOn = splitEditor && tabs.length > 0
    if (splitOn && secondaryFile && sec?.getModel) {
      applyProblemMarkers(monaco, sec, diagnostics, secondaryFile.path)
    } else if (sec?.getModel) {
      monaco.editor.setModelMarkers(sec.getModel(), PROBLEM_MARKER_OWNER, [])
    }
  }, [
    diagnostics,
    activeFile?.path,
    activeFile?.content,
    secondaryFile?.path,
    secondaryFile?.content,
    splitEditor,
    tabs.length,
    secondaryFile,
    activeFile,
  ])

  useEffect(() => {
    if (!revealRequest || !primaryRef.current || !activeFile) return
    if (activeFile.path !== revealRequest.path) return
    const ln = Math.max(1, parseInt(revealRequest.line, 10) || 1)
    const ed = primaryRef.current
    ed.revealLineInCenter(ln)
    ed.setPosition({ lineNumber: ln, column: 1 })
    ed.focus()
    onRevealHandled?.()
  }, [revealRequest, activeFile, onRevealHandled])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTab) onTabClose(activeTab)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeFile, activeTab, onTabClose])

  useEffect(() => {
    const onFormat = () => {
      const ed = primaryRef.current
      const af = activeFileRef.current
      if (!ed || !af) return
      const action = ed.getAction?.('editor.action.formatDocument')
      if (!action?.isSupported?.()) return
      action.run()
        .then(() => {
          const v = ed.getValue()
          if (v !== af.content) onContentChangeRef.current?.(af.path, v)
        })
        .catch(() => {})
    }
    window.addEventListener('myai-format-document', onFormat)
    return () => window.removeEventListener('myai-format-document', onFormat)
  }, [])

  if (tabs.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-0)', gap: 16, color: 'var(--text-2)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={28} style={{ color: 'var(--text-3)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-1)', fontWeight: 500, marginBottom: 4 }}>No file open</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Explorer, Quick Open (Ctrl+P), or Search results</p>
        </div>
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: 420, marginTop: 8,
        }}>
          {['Ctrl+S save', 'Ctrl+W close tab', 'Ctrl+P go to file', 'Ctrl+Shift+P commands'].map((hint) => (
            <span key={hint} style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '3px 8px', color: 'var(--text-2)',
            }}>{hint}</span>
          ))}
        </div>
      </div>
    )
  }

  const showSplit = splitEditor && tabs.length > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{
        height: 'var(--tab-height)',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.path}
            role="presentation"
            onClick={() => onTabSelect(tab.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px', cursor: 'pointer', flexShrink: 0,
              borderRight: '1px solid var(--border)',
              background: activeTab === tab.path ? 'var(--bg-0)' : 'transparent',
              borderBottom: activeTab === tab.path
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              color: activeTab === tab.path ? 'var(--text-0)' : 'var(--text-2)',
              fontSize: 12, fontFamily: 'var(--font-mono)',
              transition: 'var(--transition)',
              maxWidth: 200,
            }}
          >
            <span style={{ fontSize: 12, flexShrink: 0 }}>{getFileIcon(tab.name)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tab.name}
            </span>
            {tab.dirty && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)', flexShrink: 0,
              }} />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.path) }}
              style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-3)', transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-4)'; e.currentTarget.style.color = 'var(--text-0)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, flexShrink: 0 }}>
          {showSplit && (
            <select
              title="Secondary editor file"
              value={secondaryTabPath || ''}
              onChange={(e) => onSecondaryTabPathChange?.(e.target.value || null)}
              style={{
                maxWidth: 160,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-3)',
                color: 'var(--text-1)',
              }}
            >
              {tabs.map((t) => (
                <option key={t.path} value={t.path}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onToggleSplit}
            title={showSplit ? 'Join editors (single pane)' : 'Split editor right'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 10px', borderRadius: 'var(--radius-sm)',
              color: showSplit ? 'var(--accent)' : 'var(--text-2)',
              fontSize: 11,
              border: `1px solid ${showSplit ? 'var(--accent)' : 'var(--border)'}`,
              background: showSplit ? 'rgba(124,106,247,0.12)' : 'transparent',
            }}
          >
            <Columns2 size={14} />
            {showSplit ? 'Join' : 'Split'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!activeFile?.dirty}
            title="Save (Ctrl+S)"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 12px', borderRadius: 'var(--radius-sm)',
              color: activeFile?.dirty ? 'var(--accent)' : 'var(--text-3)',
              fontSize: 12, fontFamily: 'var(--font-ui)',
              opacity: activeFile?.dirty ? 1 : 0.4,
              transition: 'var(--transition)',
            }}
          >
            <Save size={12} />
            {saving ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {activeFile && <BreadcrumbBar filePath={activeFile.path} workspaceRoots={workspaceRoots} />}
      {showSplit && secondaryFile && secondaryFile.path !== activeFile?.path && (
        <BreadcrumbBar filePath={secondaryFile.path} workspaceRoots={workspaceRoots} />
      )}

      {activeFile && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          minHeight: 0,
        }}
        >
          <div style={{
            flex: 1,
            minWidth: 0,
            borderRight: showSplit ? '1px solid var(--border)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                key={`primary-${activeFile.path}`}
                height="100%"
                language={getLanguage(activeFile.name)}
                value={activeFile.content}
                onChange={(val) => onContentChange(activeFile.path, val)}
                onMount={handlePrimaryMount}
                theme="vs-dark"
                options={editorOpts}
              />
            </div>
          </div>

          {showSplit && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {secondaryFile ? (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Editor
                    key={`secondary-${secondaryFile.path}`}
                    height="100%"
                    language={getLanguage(secondaryFile.name)}
                    value={secondaryFile.content}
                    onChange={(val) => onContentChange(secondaryFile.path, val)}
                    onMount={handleSecondaryMount}
                    theme="vs-dark"
                    options={editorOpts}
                  />
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                  fontSize: 12,
                  padding: 16,
                }}>
                  Choose a file in the split dropdown above.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
