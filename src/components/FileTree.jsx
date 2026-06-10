import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronRight, ChevronDown, FolderPlus, FilePlus,
  Trash2, Edit2, RefreshCw, FolderOpen, MinusCircle,
} from 'lucide-react'
import { getFileIcon, isTextFile } from '../utils/fileUtils'

const sep = navigator.platform.includes('Win') ? '\\' : '/'

function FileNode({
  node, depth, selectedPath, onSelect, onContextMenu, expandedDirs, toggleDir,
  renaming, renameValue, setRenameValue, onRenameSubmit, onRenameCancel
}) {
  const isExpanded = expandedDirs.has(node.path)

  const handleClick = () => {
    if (node.isDir) {
      toggleDir(node.path)
    } else {
      onSelect(node)
    }
  }

  return (
    <div>
      <div
        data-reveal-path={!node.isDir ? encodeURIComponent(node.path) : undefined}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: `3px 8px 3px ${8 + depth * 14}px`,
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          background: selectedPath === node.path ? 'var(--accent-dim)' : 'transparent',
          color: selectedPath === node.path ? 'var(--text-0)' : 'var(--text-1)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          transition: 'background var(--transition)',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          if (selectedPath !== node.path)
            e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={e => {
          if (selectedPath !== node.path)
            e.currentTarget.style.background = 'transparent'
        }}
      >
        {node.isDir ? (
          <span style={{ color: 'var(--text-2)', lineHeight: 1, flexShrink: 0 }}>
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        ) : (
          <span style={{ width: 11, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>
          {getFileIcon(node.name, node.isDir)}
        </span>
        {renaming === node.path ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRenameSubmit(node, renameValue)
              } else if (e.key === 'Escape') {
                onRenameCancel()
              }
            }}
            onBlur={() => onRenameSubmit(node, renameValue)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              background: 'var(--bg-2)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-0)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              padding: '1px 4px',
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: node.isDir ? 'var(--text-0)' : isTextFile(node.name) ? 'var(--text-1)' : 'var(--text-2)',
          }}>
            {node.name}
          </span>
        )}
      </div>
      {node.isDir && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              renaming={renaming}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
          {node.children.length === 0 && (
            <div style={{
              paddingLeft: 8 + (depth + 1) * 14 + 15,
              fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
              padding: `3px 8px 3px ${8 + (depth + 1) * 14 + 15}px`
            }}>
              empty
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FileTree({
  folders,
  onFileSelect,
  selectedPath,
  onAddFolder,
  onRefresh,
  onRemoveFolder,
  onClearWorkspace,
  revealFileRequest = null,
  panelTitle = 'Explorer',
}) {
  const [expandedDirs, setExpandedDirs] = useState(new Set())
  const [contextMenu, setContextMenu] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const treeScrollRef = useRef(null)

  useEffect(() => {
    if (!revealFileRequest?.path) return
    const { path } = revealFileRequest
    const sep = navigator.platform.includes('Win') ? '\\' : '/'
    const norm = (p) => String(p || '').replace(/\\/g, '/').toLowerCase()
    const fp = norm(path)
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      for (const folder of folders) {
        const rn = norm(folder.path).replace(/\/$/, '')
        if (fp !== rn && !fp.startsWith(`${rn}/`)) continue
        next.add(folder.path)
        const prefix = String(folder.path).replace(/[/\\]+$/, '')
        const suffix = path.slice(prefix.length).replace(/^[/\\]/, '')
        const parts = suffix.split(/[/\\]/).filter(Boolean)
        for (let i = 0; i < parts.length - 1; i += 1) {
          let acc = prefix
          for (let j = 0; j <= i; j += 1) {
            acc = acc + sep + parts[j]
          }
          next.add(acc)
        }
        break
      }
      return next
    })
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sel = `[data-reveal-path="${encodeURIComponent(path)}"]`
        treeScrollRef.current?.querySelector(sel)?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [revealFileRequest, folders])

  const toggleDir = useCallback((path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  const handleContextMenu = (e, node) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const closeContext = () => setContextMenu(null)

  const handleNewFile = async () => {
    if (!contextMenu) return
    const node = contextMenu.node
    const dir = node.isDir ? node.path : node.path.split(sep).slice(0, -1).join(sep)
    const name = prompt('New file name:')
    if (!name) return closeContext()
    if (/[\\/*?:"<>|]/.test(name)) {
      alert('Invalid file name. It cannot contain \\ / * ? : " < > |')
      return closeContext()
    }
    const newPath = dir + sep + name
    if (window.electron) await window.electron.createFile(newPath)
    closeContext()
    onRefresh()
  }

  const handleNewFolder = async () => {
    if (!contextMenu) return
    const node = contextMenu.node
    const dir = node.isDir ? node.path : node.path.split(sep).slice(0, -1).join(sep)
    const name = prompt('New folder name:')
    if (!name) return closeContext()
    if (/[\\/*?:"<>|]/.test(name)) {
      alert('Invalid folder name. It cannot contain \\ / * ? : " < > |')
      return closeContext()
    }
    const newPath = dir + sep + name
    if (window.electron) await window.electron.createDirectory(newPath)
    closeContext()
    onRefresh()
  }

  const handleDelete = async () => {
    if (!contextMenu) return
    if (!confirm(`Delete ${contextMenu.node.name}?`)) return closeContext()
    if (window.electron) await window.electron.deleteFile(contextMenu.node.path)
    closeContext()
    onRefresh()
  }

  const handleRename = () => {
    if (!contextMenu) return
    setRenaming(contextMenu.node.path)
    setRenameValue(contextMenu.node.name)
    closeContext()
  }

  const handleRenameCancel = useCallback(() => {
    setRenaming(null)
    setRenameValue('')
  }, [])

  const handleRenameSubmit = useCallback(async (node, newValue) => {
    const trimmed = String(newValue || '').trim()
    if (!trimmed || trimmed === node.name) {
      setRenaming(null)
      return
    }
    const sep = navigator.platform.includes('Win') ? '\\' : '/'
    const parts = node.path.split(sep)
    parts[parts.length - 1] = trimmed
    const newPath = parts.join(sep)
    if (window.electron) {
      const res = await window.electron.renameFile(node.path, newPath)
      if (res && !res.success) {
        alert(`Failed to rename: ${res.error}`)
      }
    }
    setRenaming(null)
    setRenameValue('')
    onRefresh()
  }, [onRefresh])

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
          {panelTitle}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {folders.length > 0 && onClearWorkspace && (
            <button
              type="button"
              title="Clear workspace (remove all folders)"
              onClick={onClearWorkspace}
              style={{
                padding: '0 8px', height: 24, fontSize: 10, fontWeight: 600,
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                background: 'var(--bg-3)', color: 'var(--text-2)',
              }}
            >
              Clear
            </button>
          )}
          {[
            { icon: <FolderOpen size={13} />, title: 'Add Folder', action: onAddFolder },
            { icon: <RefreshCw size={13} />, title: 'Refresh', action: onRefresh },
          ].map(({ icon, title, action }, i) => (
            <button key={i} title={title} onClick={action} style={{
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-2)',
              transition: 'var(--transition)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-4)'; e.currentTarget.style.color = 'var(--text-0)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div 
        ref={treeScrollRef} 
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget && folders.length > 0) {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, node: folders[0] })
          }
        }}
      >
        {folders.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 10, padding: 20,
          }}>
            <FolderOpen size={28} style={{ color: 'var(--text-3)' }} />
            <p style={{ color: 'var(--text-2)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
              No folders open.<br />
              <button
                onClick={onAddFolder}
                style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 12, marginTop: 4, display: 'block' }}
              >
                Open a folder
              </button>
            </p>
          </div>
        ) : (
          folders.map((folder) => (
            <div key={folder.path}>
              {/* Root folder label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                marginBottom: 2,
              }}
                onClick={() => toggleDir(folder.path)}
              >
                {expandedDirs.has(folder.path)
                  ? <ChevronDown size={12} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                  : <ChevronRight size={12} style={{ color: 'var(--text-2)', flexShrink: 0 }} />}
                <span style={{
                  flex: 1,
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                  color: 'var(--text-0)', textTransform: 'uppercase',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {folder.name}
                </span>
                {onRemoveFolder && (
                  <button
                    type="button"
                    title="Remove folder from workspace"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFolder(folder.path)
                    }}
                    style={{
                      width: 22, height: 22, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--text-3)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-4)'
                      e.currentTarget.style.color = 'var(--red)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-3)'
                    }}
                  >
                    <MinusCircle size={14} />
                  </button>
                )}
              </div>
              {expandedDirs.has(folder.path) && folder.children.map(node => (
                <FileNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={onFileSelect}
                  onContextMenu={handleContextMenu}
                  expandedDirs={expandedDirs}
                  toggleDir={toggleDir}
                  renaming={renaming}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div onClick={closeContext} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 4, zIndex: 100,
            minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.1s ease',
          }}>
            {[
              { icon: <FilePlus size={12} />, label: 'New File', action: handleNewFile },
              { icon: <FolderPlus size={12} />, label: 'New Folder', action: handleNewFolder },
              { icon: <Edit2 size={12} />, label: 'Rename', action: handleRename },
              { icon: <Trash2 size={12} />, label: 'Delete', action: handleDelete, danger: true },
            ].map(({ icon, label, action, danger }) => (
              <button key={label} onClick={action} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                color: danger ? 'var(--red)' : 'var(--text-1)', fontSize: 12,
                transition: 'var(--transition)',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-4)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
