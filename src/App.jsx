import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react'
import TitleBar from './components/TitleBar'
import FileTree from './components/FileTree'
import ActivityBar from './components/ActivityBar'
import WorkspaceSearch from './components/WorkspaceSearch'
import SourceControl from './components/SourceControl'
import ScmDiffModal from './components/ScmDiffModal'
import EditorArea from './components/EditorArea'
import ChatPanel from './components/ChatPanel'
import BottomPanel from './components/BottomPanel'
import CommandPalette from './components/CommandPalette'
import QuickOpen from './components/QuickOpen'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import StatusBar from './components/StatusBar'
import { checkHealth } from './utils/aiApi'
import { isTextFile, getLanguage } from './utils/fileUtils'
import { parseLintDiagnostics } from './utils/parseLintDiagnostics'
import { normPathKey } from './utils/pathNorm'

const isElectron = !!window.electron

function joinWorkspacePath(root, relPath) {
  const r = String(root || '').replace(/[/\\]+$/, '')
  if (!r || relPath == null) return ''
  const sep = navigator.platform.includes('Win') ? '\\' : '/'
  const raw = String(relPath).includes(' -> ')
    ? String(relPath).split(' -> ').pop().trim()
    : String(relPath)
  const normRel = raw.split(/[/\\]/).join(sep)
  return `${r}${sep}${normRel.replace(/^[/\\]+/, '')}`
}

const LS_MINIMAP = 'myAiDesktop.minimap'
const LS_WORKSPACE = 'myAiDesktop.workspaceRoots'
const LS_PRIMARY_WS = 'myAiDesktop.primaryWorkspaceRoot'
const LS_TABS = 'myAiDesktop.openTabPaths'
const LS_ACTIVE_TAB = 'myAiDesktop.activeTabPath'

function pickProjectRoot(folders, activeFilePath) {
  if (!folders?.length) return ''
  const norm = (p) => String(p || '').replace(/\\/g, '/').toLowerCase()
  const active = norm(activeFilePath)
  if (active) {
    for (const f of folders) {
      const fp = norm(f.path).replace(/\/$/, '')
      if (!fp) continue
      if (active === fp || active.startsWith(`${fp}/`)) return f.path
    }
  }
  return folders[folders.length - 1].path
}

export default function App() {
  const [folders, setFolders] = useState([])
  const [tabs, setTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [agentOnline, setAgentOnline] = useState(false)

  const [sidebarView, setSidebarView] = useState('explorer')
  const [bottomOpen, setBottomOpen] = useState(false)
  const [bottomTab, setBottomTab] = useState('terminal')

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [problemsText, setProblemsText] = useState('')
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false)
  const [outputText, setOutputText] = useState('')
  const [splitEditor, setSplitEditor] = useState(false)
  const [secondaryTabPath, setSecondaryTabPath] = useState(null)
  const [explorerReveal, setExplorerReveal] = useState(null)
  const [scmDiff, setScmDiff] = useState(null)

  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 })
  const [minimapEnabled, setMinimapEnabled] = useState(() => {
    try {
      return localStorage.getItem(LS_MINIMAP) !== '0'
    } catch {
      return true
    }
  })
  const [revealRequest, setRevealRequest] = useState(null)
  const [gitBranch, setGitBranch] = useState(null)
  const [primaryWorkspaceRoot, setPrimaryWorkspaceRoot] = useState(() => {
    try {
      const s = localStorage.getItem(LS_PRIMARY_WS)
      return s?.trim() ? s.trim() : null
    } catch {
      return null
    }
  })

  const workspaceRoots = useMemo(() => folders.map((f) => f.path), [folders])
  const foldersRef = useRef(folders)
  const tabsRef = useRef(tabs)
  const diskHintTimerRef = useRef(null)
  const [diskReloadHint, setDiskReloadHint] = useState(null)
  /** path → latest disk snapshot when dirty tab baseline (diskSeenContent) differs from disk */
  const [dirtyDiskConflict, setDirtyDiskConflict] = useState({})

  useEffect(() => {
    foldersRef.current = folders
  }, [folders])

  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  useEffect(() => () => {
    if (diskHintTimerRef.current) clearTimeout(diskHintTimerRef.current)
  }, [])

  const persistPrimaryWorkspace = useCallback((path) => {
    setPrimaryWorkspaceRoot(path)
    try {
      if (path) localStorage.setItem(LS_PRIMARY_WS, path)
      else localStorage.removeItem(LS_PRIMARY_WS)
    } catch (_) {}
  }, [])

  useEffect(() => {
    const check = async () => setAgentOnline(await checkHealth())
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!isElectron || !window.electron?.readDir || !window.electron?.isDirectory) {
      setWorkspaceHydrated(true)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      let paths = []
      try {
        paths = JSON.parse(localStorage.getItem(LS_WORKSPACE) || '[]')
      } catch {
        if (!cancelled) setWorkspaceHydrated(true)
        return
      }
      if (!Array.isArray(paths) || paths.length === 0) {
        if (!cancelled) setWorkspaceHydrated(true)
        return
      }
      const loaded = []
      for (const p of paths) {
        if (cancelled) return
        const ok = await window.electron.isDirectory(p)
        if (!ok) continue
        const name = String(p).replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean).pop()
        const children = await window.electron.readDir(p)
        loaded.push({ name, path: p, children })
      }
      if (!cancelled) {
        if (loaded.length) setFolders(loaded)
        setWorkspaceHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isElectron || !workspaceHydrated) return
    try {
      localStorage.setItem(LS_WORKSPACE, JSON.stringify(folders.map((f) => f.path)))
    } catch (_) {}
  }, [folders, workspaceHydrated])

  // Persist open tab paths and active tab on every change
  useEffect(() => {
    if (!isElectron || !workspaceHydrated) return
    try {
      localStorage.setItem(LS_TABS, JSON.stringify(tabs.map((t) => t.path)))
    } catch (_) {}
  }, [tabs, workspaceHydrated])

  useEffect(() => {
    if (!isElectron || !workspaceHydrated) return
    try {
      if (activeTab) localStorage.setItem(LS_ACTIVE_TAB, activeTab)
      else localStorage.removeItem(LS_ACTIVE_TAB)
    } catch (_) {}
  }, [activeTab, workspaceHydrated])

  // Restore open tabs from last session after folders are loaded
  useEffect(() => {
    if (!isElectron || !workspaceHydrated || !window.electron?.readFile) return
    let cancelled = false
    ;(async () => {
      let savedPaths = []
      let savedActive = null
      try {
        savedPaths = JSON.parse(localStorage.getItem(LS_TABS) || '[]')
        savedActive = localStorage.getItem(LS_ACTIVE_TAB) || null
      } catch { return }
      if (!Array.isArray(savedPaths) || savedPaths.length === 0) return
      const restored = []
      for (const p of savedPaths) {
        if (cancelled) return
        try {
          const name = String(p).split(/[/\\]/).pop()
          if (!isTextFile(name)) continue
          const { content, error } = await window.electron.readFile(p)
          if (error || cancelled) continue
          restored.push({ name, path: p, content, dirty: false, diskSeenContent: content })
        } catch { /* skip */ }
      }
      if (!cancelled && restored.length > 0) {
        setTabs(restored)
        if (savedActive && restored.some((t) => t.path === savedActive)) {
          setActiveTab(savedActive)
        } else {
          setActiveTab(restored[0].path)
        }
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceHydrated])

  useEffect(() => {
    setActiveTab((cur) => {
      if (!tabs.length) return null
      if (cur && tabs.some((t) => t.path === cur)) return cur
      return tabs[0].path
    })
  }, [tabs])

  useEffect(() => {
    if (!splitEditor) {
      setSecondaryTabPath(null)
      return
    }
    setSecondaryTabPath((s) => {
      if (s && tabs.some((t) => t.path === s)) return s
      const other = tabs.find((t) => t.path !== activeTab) ?? tabs[0]
      return other?.path ?? null
    })
  }, [splitEditor, tabs, activeTab])

  useEffect(() => {
    if (!primaryWorkspaceRoot) return
    const ok = folders.some((f) => normPathKey(f.path) === normPathKey(primaryWorkspaceRoot))
    if (!ok) persistPrimaryWorkspace(null)
  }, [folders, primaryWorkspaceRoot, persistPrimaryWorkspace])

  const chatProjectRoot = useMemo(() => {
    const activePath = tabs.find((t) => t.path === activeTab)?.path
    const inferred = pickProjectRoot(folders, activePath)
    if (!folders.length) return ''
    if (primaryWorkspaceRoot) {
      const ok = folders.some((f) => normPathKey(f.path) === normPathKey(primaryWorkspaceRoot))
      if (ok) return primaryWorkspaceRoot
    }
    return inferred
  }, [folders, activeTab, tabs, primaryWorkspaceRoot])

  const parsedProblems = useMemo(
    () => parseLintDiagnostics(problemsText || '', chatProjectRoot),
    [problemsText, chatProjectRoot],
  )

  useEffect(() => {
    if (!isElectron || !chatProjectRoot || !window.electron?.gitWorkspaceInfo) {
      setGitBranch(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await window.electron.gitWorkspaceInfo(chatProjectRoot)
      if (!cancelled) setGitBranch(res.branch || null)
    })()
    return () => { cancelled = true }
  }, [chatProjectRoot, folders])

  const persistMinimap = useCallback((on) => {
    setMinimapEnabled(on)
    try {
      localStorage.setItem(LS_MINIMAP, on ? '1' : '0')
    } catch (_) {}
  }, [])

  const addFolder = useCallback(async () => {
    if (!isElectron) {
      alert('File system access requires the Electron desktop app.')
      return
    }
    const folderPath = await window.electron.openFolder()
    if (!folderPath) return
    const name = folderPath.split(/[\\/]/).pop()
    const children = await window.electron.readDir(folderPath)
    setFolders((prev) => {
      if (prev.some((f) => f.path === folderPath)) return prev
      return [...prev, { name, path: folderPath, children }]
    })
  }, [])

  const refreshFolders = useCallback(async () => {
    if (!isElectron) return
    const cur = foldersRef.current
    const updated = await Promise.all(
      cur.map(async (f) => ({
        ...f,
        children: await window.electron.readDir(f.path),
      }))
    )
    setFolders(updated)
  }, [])

  const showDiskReloadHint = useCallback((label) => {
    setDiskReloadHint(label)
    if (diskHintTimerRef.current) clearTimeout(diskHintTimerRef.current)
    diskHintTimerRef.current = setTimeout(() => setDiskReloadHint(null), 4200)
  }, [])

  /**
   * Re-read open tabs from disk: auto-reload clean tabs; track dirty tabs where disk diverged
   * from diskSeenContent (last known on-disk version for this buffer).
   */
  const syncOpenTabsFromDisk = useCallback(async () => {
    if (!isElectron || !window.electron?.readFile) return
    const curTabs = tabsRef.current
    const diskMap = new Map()
    for (const tab of curTabs) {
      if (!isTextFile(tab.name)) continue
      const { content, error } = await window.electron.readFile(tab.path)
      if (!error) diskMap.set(tab.path, content)
    }

    const updates = new Map()
    const names = []
    const nextConflicts = {}

    for (const tab of curTabs) {
      const diskNow = diskMap.get(tab.path)
      if (!isTextFile(tab.name) || diskNow === undefined) continue
      if (!tab.dirty) {
        if (diskNow !== tab.content) {
          updates.set(tab.path, diskNow)
          names.push(tab.name)
        }
        continue
      }
      const seen = tab.diskSeenContent ?? diskNow
      if (diskNow !== seen) {
        nextConflicts[tab.path] = diskNow
      }
    }

    setTabs((prev) => prev.map((t) => {
      const diskNow = diskMap.get(t.path)
      if (!isTextFile(t.name) || diskNow === undefined) return t
      let nt = { ...t }
      if (nt.diskSeenContent === undefined) nt.diskSeenContent = diskNow
      if (!nt.dirty && updates.has(nt.path)) {
        const c = updates.get(nt.path)
        return { ...nt, content: c, dirty: false, diskSeenContent: c }
      }
      return nt
    }))

    setDirtyDiskConflict(nextConflicts)

    if (names.length > 0) {
      const label = names.length <= 2
        ? names.join(', ')
        : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
      showDiskReloadHint(label)
    }
  }, [showDiskReloadHint])

  const reloadDirtyConflictFromDisk = useCallback((path) => {
    setDirtyDiskConflict((prev) => {
      const snap = prev[path]
      if (snap === undefined) return prev
      setTabs((tprev) => tprev.map((t) => (t.path === path
        ? { ...t, content: snap, dirty: false, diskSeenContent: snap }
        : t)))
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  const keepMineDirtyConflict = useCallback((path) => {
    setDirtyDiskConflict((prev) => {
      const snap = prev[path]
      if (snap === undefined) return prev
      setTabs((tprev) => tprev.map((t) => (t.path === path
        ? { ...t, diskSeenContent: snap }
        : t)))
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  useEffect(() => {
    if (!isElectron || !window.electron?.workspaceSetWatchRoots) return undefined
    window.electron.workspaceSetWatchRoots(workspaceRoots).catch(() => {})
    const unsub = window.electron.onWorkspaceFsChanged?.(() => {
      refreshFolders()
      syncOpenTabsFromDisk()
    }) ?? (() => {})
    return () => {
      unsub()
      window.electron.workspaceSetWatchRoots([]).catch(() => {})
    }
  }, [workspaceRoots, refreshFolders, syncOpenTabsFromDisk])

  const removeFolderFromWorkspace = useCallback((folderPath) => {
    const fp = normPathKey(folderPath)
    setFolders((prev) => prev.filter((f) => normPathKey(f.path) !== fp))
    setTabs((prev) => prev.filter((t) => {
      const tp = normPathKey(t.path)
      return !(tp === fp || tp.startsWith(`${fp}/`))
    }))
    setDirtyDiskConflict((prev) => {
      const next = { ...prev }
      for (const p of Object.keys(next)) {
        const tp = normPathKey(p)
        if (tp === fp || tp.startsWith(`${fp}/`)) delete next[p]
      }
      return next
    })
  }, [])

  const clearWorkspace = useCallback(() => {
    if (!confirm('Remove all folders from the workspace and close all editors?')) return
    setFolders([])
    setTabs([])
    setActiveTab(null)
    setSecondaryTabPath(null)
    setSplitEditor(false)
    setDirtyDiskConflict({})
    persistPrimaryWorkspace(null)
  }, [persistPrimaryWorkspace])

  const openFile = useCallback(async (node, jumpLine) => {
    if (node.isDir) return
    if (!isTextFile(node.name)) {
      alert(`Cannot open binary file: ${node.name}`)
      return
    }

    if (tabs.some((t) => t.path === node.path)) {
      setActiveTab(node.path)
      if (jumpLine != null) setRevealRequest({ path: node.path, line: jumpLine })
      return
    }

    if (isElectron) {
      const { content, error } = await window.electron.readFile(node.path)
      if (error) {
        alert(`Failed to read file: ${error}`)
        return
      }
      setTabs((prev) => [...prev, {
        name: node.name,
        path: node.path,
        content,
        dirty: false,
        diskSeenContent: content,
      }])
    } else {
      const stub = `// ${node.path}\n// Electron required for real files.\n`
      setTabs((prev) => [...prev, {
        name: node.name,
        path: node.path,
        content: stub,
        dirty: false,
        diskSeenContent: stub,
      }])
    }
    setActiveTab(node.path)
    if (jumpLine != null) setRevealRequest({ path: node.path, line: jumpLine })
  }, [tabs])

  const openPath = useCallback(async (filePath, jumpLine) => {
    const name = String(filePath).split(/[/\\]/).pop()
    await openFile({ name, path: filePath, isDir: false }, jumpLine)
  }, [openFile])

  const openDiagnostic = useCallback((filePath, line, _column) => {
    openPath(filePath, line)
    setSidebarView('explorer')
    setBottomTab('problems')
    setBottomOpen(true)
  }, [openPath])

  const revealActiveFileInExplorer = useCallback(() => {
    if (!activeTab) return
    setSidebarView('explorer')
    setExplorerReveal({ path: activeTab, id: Date.now() })
  }, [activeTab])

  const openScmDiff = useCallback(async (relPath, xy) => {
    const root = chatProjectRoot
    if (!root || !window.electron?.readFile || !window.electron?.gitExec) return
    const xyStr = String(xy || '  ')
    const pathPart = String(relPath).includes(' -> ')
      ? String(relPath).split(' -> ').pop().trim()
      : String(relPath)
    const gitPath = pathPart.split(/[/\\]/).join('/')
    const absPath = joinWorkspacePath(root, relPath)
    const isUntracked = xyStr[0] === '?' && xyStr[1] === '?'

    let original = ''
    if (!isUntracked) {
      const r = await window.electron.gitExec({ cwd: root, args: ['show', `HEAD:${gitPath}`] })
      if (r.ok) original = r.stdout ?? ''
    }

    let modified = ''
    const rf = await window.electron.readFile(absPath)
    if (!rf.error && rf.content != null) modified = rf.content

    setScmDiff({
      title: `${pathPart} — ${root}`,
      original,
      modified,
      language: getLanguage(pathPart.split(/[/\\]/).pop() || ''),
    })
  }, [chatProjectRoot])

  const closeTab = useCallback((path) => {
    const tab = tabs.find((t) => t.path === path)
    if (tab?.dirty && !confirm('Unsaved changes. Close anyway?')) return
    setTabs((prev) => prev.filter((t) => t.path !== path))
    setDirtyDiskConflict((prev) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
    setSecondaryTabPath((s) => (s === path ? null : s))
    if (activeTab === path) {
      const idx = tabs.findIndex((t) => t.path === path)
      const next = tabs[idx + 1] ?? tabs[idx - 1]
      setActiveTab(next?.path ?? null)
    }
  }, [tabs, activeTab])

  const updateContent = useCallback((path, value) => {
    setTabs((prev) => prev.map((t) =>
      t.path === path ? { ...t, content: value, dirty: true } : t
    ))
  }, [])

  const saveFile = useCallback(async (path, content) => {
    if (!isElectron) return
    const { success, error } = await window.electron.saveFile(path, content)
    if (!success) {
      alert(`Save failed: ${error}`)
      return
    }
    setTabs((prev) => prev.map((t) =>
      t.path === path ? { ...t, dirty: false, diskSeenContent: content } : t
    ))
    setDirtyDiskConflict((prev) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  const activeFileTab = tabs.find((t) => t.path === activeTab) ?? null

  const toggleBottomTerminal = useCallback(() => {
    if (bottomOpen && bottomTab === 'terminal') setBottomOpen(false)
    else {
      setBottomTab('terminal')
      setBottomOpen(true)
    }
  }, [bottomOpen, bottomTab])

  const toggleBottomProblems = useCallback(() => {
    if (bottomOpen && bottomTab === 'problems') setBottomOpen(false)
    else {
      setBottomTab('problems')
      setBottomOpen(true)
    }
  }, [bottomOpen, bottomTab])

  const toggleBottomOutput = useCallback(() => {
    if (bottomOpen && bottomTab === 'output') setBottomOpen(false)
    else {
      setBottomTab('output')
      setBottomOpen(true)
    }
  }, [bottomOpen, bottomTab])

  const appendTaskOutput = useCallback((label, body) => {
    const stamp = new Date().toISOString().slice(11, 19)
    const block = `[${stamp}] ${label}\n${body}`
    setOutputText((prev) => (prev ? `${prev}\n\n${block}` : block))
  }, [])

  const clearTaskOutput = useCallback(() => setOutputText(''), [])

  const toggleSplitEditor = useCallback(() => {
    setSplitEditor((v) => !v)
  }, [])

  /** Runs `shellExec` in the current chat project root and appends to Output; optionally mirrors text into Problems (lint). */
  const runWorkspaceShellTask = useCallback(async ({
    command,
    title,
    mirrorToProblems = false,
  }) => {
    const root = chatProjectRoot
    const label = title || command
    if (!root || !window.electron?.shellExec) {
      appendTaskOutput(label, '(no workspace folder or shell unavailable — open a folder in Electron)')
      setBottomTab('output')
      setBottomOpen(true)
      return
    }
    if (mirrorToProblems) {
      setDiagnosticsLoading(true)
      setProblemsText(`Running ${command} …`)
    }
    appendTaskOutput(label, '(started)')
    setBottomTab('output')
    setBottomOpen(true)
    try {
      const res = await window.electron.shellExec({
        cwd: root,
        command,
      })
      const out = [res.stdout, res.stderr].filter(Boolean).join('\n')
      const text = out.trim() || (res.ok ? '(exit 0 — no output)' : '(command failed)')
      if (mirrorToProblems) setProblemsText(text)
      appendTaskOutput(
        `${label} — ${res.ok ? 'ok' : 'failed'}`,
        `${text}${res.ok ? '' : `\nexit ${res.code ?? '?'}`}`,
      )
    } catch (e) {
      const msg = String(e.message || e)
      if (mirrorToProblems) setProblemsText(msg)
      appendTaskOutput(`${label} — error`, msg)
    } finally {
      if (mirrorToProblems) setDiagnosticsLoading(false)
    }
  }, [chatProjectRoot, appendTaskOutput])

  const runLintDiagnostics = useCallback(
    () => runWorkspaceShellTask({
      command: 'npm run lint',
      title: 'npm run lint',
      mirrorToProblems: true,
    }),
    [runWorkspaceShellTask],
  )

  const runNpmTypecheckDiagnostics = useCallback(
    () => runWorkspaceShellTask({
      command: 'npm run typecheck',
      title: 'npm run typecheck',
      mirrorToProblems: true,
    }),
    [runWorkspaceShellTask],
  )

  const runTscNoEmitDiagnostics = useCallback(
    () => runWorkspaceShellTask({
      command: 'npx --yes -p typescript tsc --noEmit',
      title: 'tsc --noEmit (npx typescript)',
      mirrorToProblems: true,
    }),
    [runWorkspaceShellTask],
  )

  const runCustomWorkspaceCommand = useCallback(() => {
    const cmd = window.prompt('Run in workspace root:', 'npm run ')
    if (!cmd?.trim()) return
    const c = cmd.trim()
    runWorkspaceShellTask({ command: c, title: c })
  }, [runWorkspaceShellTask])

  const commands = useMemo(() => [
    { id: 'folder', label: 'File: Open Folder…', detail: '', run: () => addFolder() },
    { id: 'save', label: 'File: Save', detail: 'Ctrl+S', run: () => activeFileTab?.dirty && saveFile(activeFileTab.path, activeFileTab.content) },
    {
      id: 'formatDoc',
      label: 'Editor: Format document',
      detail: 'Shift+Alt+F',
      run: () => window.dispatchEvent(new Event('myai-format-document')),
    },
    { id: 'explorer', label: 'View: Show Explorer', detail: '', run: () => setSidebarView('explorer') },
    { id: 'search', label: 'View: Show Search', detail: 'Ctrl+Shift+F', run: () => setSidebarView('search') },
    { id: 'scm', label: 'View: Show Source Control', detail: '', run: () => setSidebarView('scm') },
    { id: 'terminal', label: 'View: Toggle Terminal', detail: 'Ctrl+`', run: toggleBottomTerminal },
    { id: 'output', label: 'View: Toggle Output', detail: 'Ctrl+Shift+U', run: toggleBottomOutput },
    { id: 'palette', label: 'Help: Command Palette', detail: 'Ctrl+Shift+P', run: () => setPaletteOpen(true) },
    { id: 'quick', label: 'Go to File…', detail: 'Ctrl+P', run: () => setQuickOpen(true) },
    { id: 'minimap', label: minimapEnabled ? 'View: Hide Minimap' : 'View: Show Minimap', detail: '', run: () => persistMinimap(!minimapEnabled) },
    {
      id: 'shortcuts',
      label: 'Help: Keyboard Shortcuts',
      detail: '',
      run: () => setShortcutsOpen(true),
    },
    {
      id: 'lint',
      label: 'Tasks: Run npm run lint',
      detail: 'Output + Problems',
      run: () => {
        runLintDiagnostics()
      },
    },
    {
      id: 'typecheck-npm',
      label: 'Tasks: npm run typecheck',
      detail: 'Problems',
      run: () => runNpmTypecheckDiagnostics(),
    },
    {
      id: 'typecheck-tsc',
      label: 'Tasks: tsc --noEmit (npx typescript)',
      detail: 'Problems',
      run: () => runTscNoEmitDiagnostics(),
    },
    {
      id: 'task-test',
      label: 'Tasks: npm test',
      detail: 'Output',
      run: () => runWorkspaceShellTask({ command: 'npm test', title: 'npm test' }),
    },
    {
      id: 'task-build',
      label: 'Tasks: npm run build',
      detail: 'Output',
      run: () => runWorkspaceShellTask({ command: 'npm run build', title: 'npm run build' }),
    },
    {
      id: 'task-custom',
      label: 'Tasks: Run command in workspace…',
      detail: 'Output',
      run: runCustomWorkspaceCommand,
    },
    {
      id: 'split',
      label: splitEditor ? 'Editor: Join editor group' : 'Editor: Split editor right',
      detail: 'Ctrl+\\',
      run: toggleSplitEditor,
    },
    {
      id: 'clearWs',
      label: 'Workspace: Clear all folders…',
      detail: '',
      run: clearWorkspace,
    },
    {
      id: 'primaryAuto',
      label: 'Workspace: AI folder — automatic (from active file)',
      detail: '',
      run: () => persistPrimaryWorkspace(null),
    },
    {
      id: 'reloadTabsDisk',
      label: 'File: Reload clean tabs from disk',
      detail: '',
      run: () => {
        refreshFolders()
        syncOpenTabsFromDisk()
      },
    },
    {
      id: 'revealExplorer',
      label: 'View: Reveal Active File in Explorer',
      detail: 'Alt+R',
      run: revealActiveFileInExplorer,
    },
  ], [
    addFolder,
    activeFileTab,
    saveFile,
    toggleBottomTerminal,
    toggleBottomOutput,
    minimapEnabled,
    persistMinimap,
    runLintDiagnostics,
    runNpmTypecheckDiagnostics,
    runTscNoEmitDiagnostics,
    runWorkspaceShellTask,
    runCustomWorkspaceCommand,
    splitEditor,
    toggleSplitEditor,
    clearWorkspace,
    persistPrimaryWorkspace,
    refreshFolders,
    syncOpenTabsFromDisk,
    revealActiveFileInExplorer,
  ])

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()

      if (key === 'p' && e.shiftKey) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (key === 'p' && !e.shiftKey) {
        const t = e.target
        if (t?.tagName === 'TEXTAREA' && t?.hasAttribute?.('data-chat-input')) return
        e.preventDefault()
        setQuickOpen(true)
        return
      }
      if (e.code === 'Backquote' && !e.shiftKey) {
        e.preventDefault()
        toggleBottomTerminal()
        return
      }
      if (key === 'e' && e.shiftKey) {
        e.preventDefault()
        setSidebarView('explorer')
        return
      }
      if (key === 'f' && e.shiftKey) {
        e.preventDefault()
        setSidebarView('search')
        return
      }
      if (key === 'g' && e.shiftKey) {
        e.preventDefault()
        setSidebarView('scm')
        return
      }
      if (key === 'u' && e.shiftKey) {
        e.preventDefault()
        toggleBottomOutput()
        return
      }
      if ((e.code === 'Backslash' || e.code === 'IntlBackslash') && !e.shiftKey) {
        e.preventDefault()
        toggleSplitEditor()
        return
      }
      if (e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyF') {
        const t = e.target
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return
        e.preventDefault()
        window.dispatchEvent(new Event('myai-format-document'))
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyR') {
        const t = e.target
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
        e.preventDefault()
        revealActiveFileInExplorer()
        return
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [toggleBottomTerminal, toggleBottomOutput, toggleSplitEditor, revealActiveFileInExplorer])

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-0)',
      overflow: 'hidden',
    }}>
      <TitleBar agentOnline={agentOnline} onOpenShortcuts={() => setShortcutsOpen(true)} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <ActivityBar
          activeView={sidebarView}
          onViewChange={setSidebarView}
          bottomOpen={bottomOpen}
          bottomTab={bottomTab}
          onToggleTerminal={toggleBottomTerminal}
          onToggleProblems={toggleBottomProblems}
          onToggleOutput={toggleBottomOutput}
          problemsCount={parsedProblems.length}
        />

        {sidebarView === 'explorer' && (
          <FileTree
            folders={folders}
            selectedPath={activeTab}
            onFileSelect={(n) => openFile(n)}
            onAddFolder={addFolder}
            onRefresh={refreshFolders}
            onRemoveFolder={removeFolderFromWorkspace}
            onClearWorkspace={clearWorkspace}
            revealFileRequest={explorerReveal}
            panelTitle="Explorer"
          />
        )}
        {sidebarView === 'search' && (
          <WorkspaceSearch
            roots={workspaceRoots}
            onOpenResult={(m) => openPath(m.path, m.line)}
          />
        )}
        {sidebarView === 'scm' && (
          <SourceControl
            workspaceRoot={chatProjectRoot}
            onOpenFile={(p) => openPath(p)}
            onOpenDiff={openScmDiff}
          />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {diskReloadHint ? (
            <div style={{
              flexShrink: 0,
              padding: '6px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-1)',
              background: 'rgba(62, 207, 207, 0.12)',
              borderBottom: '1px solid rgba(62, 207, 207, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
            >
              <span>
                <strong style={{ color: 'var(--accent-2)' }}>Disk updated</strong>
                {' — reloaded clean tabs: '}
                {diskReloadHint}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (diskHintTimerRef.current) clearTimeout(diskHintTimerRef.current)
                  setDiskReloadHint(null)
                }}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: '2px 6px',
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {Object.keys(dirtyDiskConflict).length > 0 ? (
            <div style={{
              flexShrink: 0,
              padding: '8px 14px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-1)',
              background: 'rgba(251, 191, 36, 0.1)',
              borderBottom: '1px solid rgba(251, 191, 36, 0.45)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
            }}
            >
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <strong style={{ color: '#eab308' }}>Disk conflict</strong>
                {' — unsaved edits vs changed file(s): '}
                {Object.keys(dirtyDiskConflict)
                  .map((p) => p.replace(/\\/g, '/').split('/').filter(Boolean).pop())
                  .join(', ')}
              </span>
              {activeTab && dirtyDiskConflict[activeTab] ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('Discard unsaved edits and replace this tab with the file on disk?')) return
                      reloadDirtyConflictFromDisk(activeTab)
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-3)',
                      color: 'var(--text-0)',
                      cursor: 'pointer',
                    }}
                  >
                    Reload from disk
                  </button>
                  <button
                    type="button"
                    title="Keep your buffer; treat current disk as the new baseline (you can overwrite disk on Save)"
                    onClick={() => keepMineDirtyConflict(activeTab)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(62, 207, 207, 0.35)',
                      background: 'transparent',
                      color: 'var(--accent-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Keep my edits
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  Switch to a conflicting tab for actions.
                </span>
              )}
            </div>
          ) : null}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            <EditorArea
              tabs={tabs}
              activeTab={activeTab}
              onTabSelect={setActiveTab}
              onTabClose={closeTab}
              onSave={saveFile}
              onContentChange={updateContent}
              onCursorPositionChange={setCursorPos}
              minimapEnabled={minimapEnabled}
              revealRequest={revealRequest}
              onRevealHandled={() => setRevealRequest(null)}
              workspaceRoots={workspaceRoots}
              splitEditor={splitEditor}
              secondaryTabPath={secondaryTabPath}
              onSecondaryTabPathChange={setSecondaryTabPath}
              onToggleSplit={toggleSplitEditor}
              diagnostics={parsedProblems}
            />

            <ChatPanel
              activeFile={activeFileTab}
              projectRoot={chatProjectRoot}
              workspaceFolderCount={folders.length}
              workspaceFolders={folders.map((f) => ({ path: f.path, name: f.name }))}
              primaryWorkspaceRoot={primaryWorkspaceRoot}
              onPrimaryWorkspaceRootChange={persistPrimaryWorkspace}
              agentOnline={agentOnline}
            />
          </div>

          {bottomOpen && (
            <BottomPanel
              tab={bottomTab}
              onTabChange={(id) => {
                setBottomTab(id)
                setBottomOpen(true)
              }}
              terminalCwd={chatProjectRoot}
              problemsText={problemsText}
              diagnosticsLoading={diagnosticsLoading}
              onRunDiagnostics={runLintDiagnostics}
              hasWorkspace={!!chatProjectRoot}
              problemsWorkspaceRoot={chatProjectRoot}
              diagnostics={parsedProblems}
              problemsCount={parsedProblems.length}
              onOpenDiagnostic={openDiagnostic}
              onRunTsc={runTscNoEmitDiagnostics}
              outputText={outputText}
              onClearOutput={clearTaskOutput}
              onTerminalTaskOutput={appendTaskOutput}
            />
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      <QuickOpen
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        roots={workspaceRoots}
        onPick={(p) => openPath(p)}
      />

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <ScmDiffModal
        open={!!scmDiff}
        title={scmDiff?.title ?? ''}
        original={scmDiff?.original ?? ''}
        modified={scmDiff?.modified ?? ''}
        language={scmDiff?.language ?? 'plaintext'}
        onClose={() => setScmDiff(null)}
      />

      <StatusBar
        activeFile={activeFileTab}
        agentOnline={agentOnline}
        cursorLine={cursorPos.line}
        cursorColumn={cursorPos.column}
        gitBranch={gitBranch}
      />
    </div>
  )
}
