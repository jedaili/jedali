const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec, execSync, spawn } = require('child_process')

/** Optional full PTY (needs native rebuild). Falls back to piped shell. */
let nodePty = null
try {
  nodePty = require('node-pty')
} catch {
  nodePty = null
}

let activePtySession = null
let activeStreamProc = null

function killActiveTerminal() {
  if (activePtySession) {
    try {
      activePtySession.kill()
    } catch (_) {}
    activePtySession = null
  }
  if (activeStreamProc) {
    try {
      activeStreamProc.kill()
    } catch (_) {}
    activeStreamProc = null
  }
}

function attachTerminalOut(win, proc) {
  const send = (chunk) => {
    if (!win.isDestroyed()) win.webContents.send('pty:data', chunk)
  }
  proc.stdout?.on('data', (d) => send(d.toString()))
  proc.stderr?.on('data', (d) => send(d.toString()))
  proc.on('exit', (code, signal) => {
    activeStreamProc = null
    send(`\r\n\x1b[33m[Shell exited — code ${code}${signal ? ` signal ${signal}` : ''}]\x1b[0m\r\n`)
    if (!win.isDestroyed()) win.webContents.send('pty:exit', { exitCode: code ?? 0 })
  })
}

function spawnStreamShell(win, cwd, cols, rows) {
  killActiveTerminal()
  const safeCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd()
  let proc
  if (process.platform === 'win32') {
    proc = spawn(process.env.ComSpec || 'cmd.exe', ['/K'], {
      cwd: safeCwd,
      env: process.env,
      windowsHide: true,
    })
  } else {
    const sh = process.env.SHELL || '/bin/bash'
    proc = spawn(sh, ['-l'], {
      cwd: safeCwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    })
  }
  activeStreamProc = proc
  attachTerminalOut(win, proc)
  return { ok: true, backend: 'stream', cols, rows }
}

function spawnNodePty(win, cwd, cols, rows) {
  if (!nodePty) return null
  const safeCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd()
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
  const args = isWin ? ['-NoLogo'] : []
  try {
    const term = nodePty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: Math.max(cols || 80, 2),
      rows: Math.max(rows || 24, 2),
      cwd: safeCwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    })
    activePtySession = term
    term.onData((data) => {
      if (!win.isDestroyed()) win.webContents.send('pty:data', data)
    })
    term.onExit(({ exitCode }) => {
      activePtySession = null
      if (!win.isDestroyed()) win.webContents.send('pty:exit', { exitCode: exitCode ?? 0 })
    })
    return { ok: true, backend: 'node-pty', cols, rows }
  } catch (e) {
    killActiveTerminal()
    return null
  }
}

ipcMain.handle('pty:spawn', async (event, { cwd, cols, rows }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { ok: false, error: 'no-window' }
  killActiveTerminal()
  const ptyOk = spawnNodePty(win, cwd, cols, rows)
  if (ptyOk) return ptyOk
  return spawnStreamShell(win, cwd, cols, rows)
})

ipcMain.on('pty:write', (event, data) => {
  const s = typeof data === 'string' ? data : ''
  if (!s) return
  if (activePtySession) {
    try {
      activePtySession.write(s)
    } catch (_) {}
  } else if (activeStreamProc?.stdin) {
    try {
      activeStreamProc.stdin.write(s)
    } catch (_) {}
  }
})

ipcMain.handle('pty:resize', (_, { cols, rows }) => {
  const c = Number(cols)
  const r = Number(rows)
  if (activePtySession && c > 0 && r > 0) {
    try {
      activePtySession.resize(c, r)
    } catch (_) {}
  }
  return { ok: true }
})

ipcMain.handle('pty:kill', () => {
  killActiveTerminal()
  return { ok: true }
})

ipcMain.handle('pty:capabilities', () => ({
  nodePtyLoaded: !!nodePty,
}))

const SKIP_DIR_NAMES = new Set([
  'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next',
  'coverage', '.turbo', 'target', '.gradle', 'Pods',
])

function skipDirectory(name) {
  if (SKIP_DIR_NAMES.has(name)) return true
  if (name.startsWith('.') && name !== '.github') return true
  return false
}

function walkFiles(rootDir, maxDepth, depth = 0, out = [], maxFiles = 12000) {
  if (out.length >= maxFiles || depth > maxDepth) return out
  let entries
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (out.length >= maxFiles) break
    const full = path.join(rootDir, e.name)
    if (e.isDirectory()) {
      if (skipDirectory(e.name)) continue
      walkFiles(full, maxDepth, depth + 1, out, maxFiles)
    } else if (e.isFile()) {
      out.push(full)
    }
  }
  return out
}

function isProbablyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const bin = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'pdf', 'zip', 'gz',
    'exe', 'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'mp4',
    'sqlite', 'db', 'bin', 'pyc', 'class',
  ])
  if (bin.has(ext)) return false
  return true
}

ipcMain.handle('workspace:listFiles', async (_, roots) => {
  const maxTotal = 8000
  const list = []
  const rootsArr = roots || []
  const perRoot = Math.max(400, Math.floor(maxTotal / Math.max(rootsArr.length, 1)))
  for (const r of rootsArr) {
    if (!r || list.length >= maxTotal) break
    try {
      if (!fs.statSync(r).isDirectory()) continue
    } catch {
      continue
    }
    walkFiles(r, 12, 0, list, Math.min(perRoot, maxTotal - list.length))
  }
  return list.slice(0, maxTotal).map((p) => ({ path: p, label: p }))
})

ipcMain.handle('workspace:search', async (_, { roots, query, maxResults = 300, useRegex = false, caseSensitive = false, fileFilter = '' }) => {
  const q = String(query || '').trim()
  if (!q || !(roots || []).length) return { matches: [], truncated: false }

  let searchRegex
  try {
    const flags = caseSensitive ? 'g' : 'gi'
    searchRegex = useRegex ? new RegExp(q, flags) : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
  } catch (e) {
    return { matches: [], truncated: false, error: `Invalid regex: ${e.message}` }
  }

  // Parse file filter: e.g. "*.js,*.ts" → ['.js', '.ts']
  const filterExts = (fileFilter || '')
    .split(',')
    .map(s => s.trim().replace(/^\*/, '').toLowerCase())
    .filter(Boolean)

  const matches = []
  const maxFiles = 4000
  const maxBytes = 512 * 1024
  let truncated = false

  const files = []
  for (const r of roots) {
    if (!r || files.length >= maxFiles) { truncated = true; break }
    try {
      if (fs.statSync(r).isDirectory()) walkFiles(r, 10, 0, files, maxFiles)
    } catch { /* ignore */ }
  }

  for (const filePath of files) {
    if (matches.length >= maxResults) { truncated = true; break }
    if (!isProbablyTextFile(filePath)) continue
    if (filterExts.length > 0) {
      const ext = path.extname(filePath).toLowerCase()
      if (!filterExts.includes(ext)) continue
    }
    let stat
    try { stat = fs.statSync(filePath) } catch { continue }
    if (stat.size > maxBytes) continue
    let content
    try { content = fs.readFileSync(filePath, 'utf8') } catch { continue }

    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxResults) { truncated = true; break }
      searchRegex.lastIndex = 0
      const line = lines[i]
      const matchResult = searchRegex.exec(line)
      if (matchResult) {
        matches.push({
          path: filePath,
          line: i + 1,
          column: matchResult.index + 1,
          preview: line,
          matchStart: matchResult.index,
          matchLength: matchResult[0].length,
        })
        // Reset lastIndex since we only need first match per line
        searchRegex.lastIndex = 0
      }
    }
  }
  return { matches, truncated }
})

ipcMain.handle('workspace:replace', async (_, { filePath, query, replacement, useRegex = false, caseSensitive = false }) => {
  const q = String(query || '').trim()
  if (!q || !filePath) return { ok: false, error: 'Missing parameters' }
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = useRegex
      ? new RegExp(q, flags)
      : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    const newContent = content.replace(regex, replacement || '')
    fs.writeFileSync(filePath, newContent, 'utf8')
    return { ok: true, count: (content.match(regex) || []).length }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('git:workspaceInfo', async (_, cwd) => {
  const root = String(cwd || '').trim()
  if (!root) {
    return { branch: null, statusLines: [], entries: [], error: 'No folder' }
  }
  const gitDir = path.join(root, '.git')
  try {
    if (!fs.existsSync(gitDir)) {
      return { branch: null, statusLines: [], entries: [], error: 'Not a git repository' }
    }
  } catch {
    return { branch: null, statusLines: [], entries: [], error: 'Not a git repository' }
  }
  let branch = ''
  try {
    branch = execSync('git branch --show-current', {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    }).trim()
  } catch {
    branch = ''
  }
  let statusLines = []
  let entries = []
  try {
    const porcelainOut = execSync('git status --porcelain=v1 -u', {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    })
    for (const line of porcelainOut.split(/\r?\n/).filter(Boolean).slice(0, 500)) {
      if (line.length < 4) continue
      const xy = line.slice(0, 2)
      const pathPart = line.slice(3).trim()
      if (!pathPart) continue
      entries.push({ xy, path: pathPart })
    }
    const sb = execSync('git status -sb', {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    })
    statusLines = sb.split(/\r?\n/).filter(Boolean).slice(0, 200)
  } catch (e) {
    return { branch: branch || null, statusLines: [], entries: [], error: e.message }
  }
  return { branch: branch || null, statusLines, entries, error: null }
})

ipcMain.handle('git:exec', async (_, { cwd, args }) => {
  const root = String(cwd || '').trim()
  if (!root || !Array.isArray(args) || args.length === 0) {
    return { ok: false, stdout: '', stderr: 'Invalid git request', code: 1 }
  }
  const gitDir = path.join(root, '.git')
  try {
    if (!fs.existsSync(gitDir)) {
      return { ok: false, stdout: '', stderr: 'Not a git repository', code: 1 }
    }
  } catch {
    return { ok: false, stdout: '', stderr: 'Not a git repository', code: 1 }
  }
  return new Promise((resolve) => {
    const child = spawn('git', args.map(String), {
      cwd: root,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })
    child.on('error', (e) => {
      resolve({ ok: false, stdout, stderr: stderr || e.message, code: 1 })
    })
    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code: code ?? 0,
      })
    })
  })
})

let workspaceWatchCleanup = null

ipcMain.handle('workspace:setWatchRoots', async (_evt, roots) => {
  if (workspaceWatchCleanup) {
    try {
      workspaceWatchCleanup()
    } catch (_) {}
    workspaceWatchCleanup = null
  }
  const list = (Array.isArray(roots) ? roots : [])
    .map((r) => String(r || '').trim())
    .filter(Boolean)
  if (!list.length) return { ok: true }

  const watchers = []
  let debounceTimer = null
  const notify = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('workspace:fsChanged', {})
      }
    }, 400)
  }

  for (const root of list) {
    try {
      if (!fs.existsSync(root)) continue
      watchers.push(fs.watch(root, { recursive: true }, () => notify()))
    } catch {
      try {
        if (fs.existsSync(root)) watchers.push(fs.watch(root, () => notify()))
      } catch (_) {}
    }
  }

  workspaceWatchCleanup = () => {
    clearTimeout(debounceTimer)
    for (const w of watchers) {
      try {
        w.close()
      } catch (_) {}
    }
  }
  return { ok: true }
})

app.on('before-quit', () => {
  if (workspaceWatchCleanup) {
    try {
      workspaceWatchCleanup()
    } catch (_) {}
    workspaceWatchCleanup = null
  }
})

/** HTTP from main process — avoids renderer CORS / file:// fetch limits when calling My_ai. */
ipcMain.handle('myai:fetch', async (_, { url, method = 'GET', headers = {}, body, timeoutMs = 120_000 }) => {
  const target = String(url || '').trim()
  if (!target) return { ok: false, status: 0, statusText: 'Missing URL', headers: {}, body: '' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 120_000))
  try {
    const res = await fetch(target, {
      method,
      headers,
      body: body != null && method !== 'GET' && method !== 'HEAD' ? body : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    const hdrs = {}
    res.headers.forEach((v, k) => {
      hdrs[k] = v
    })
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: hdrs,
      body: text,
    }
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Request timed out' : String(err.message || err)
    return { ok: false, status: 0, statusText: msg, headers: {}, body: '' }
  } finally {
    clearTimeout(timer)
  }
})

ipcMain.handle('shell:exec', async (_, { cwd, command }) => {
  const c = String(command || '').trim()
  const dir = String(cwd || '').trim()
  if (!c) return { ok: false, stdout: '', stderr: 'Empty command' }
  return new Promise((resolve) => {
    exec(
      c,
      {
        cwd: dir || undefined,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
        shell: process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : true,
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: stdout || '',
          stderr: stderr || (err && err.message) || '',
          code: err && typeof err.code === 'number' ? err.code : 0,
        })
      }
    )
  })
})

/** Never use NODE_ENV alone: packaged installers often omit it → false “dev” → black screen on LAN PCs. */
function loadRenderer(win) {
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
    return
  }
  const devUrl =
    process.env.ELECTRON_RENDERER_URL ||
    process.env.VITE_DEV_SERVER_URL ||
    'http://127.0.0.1:5173'
  win.loadURL(devUrl).catch(() => {})
  win.webContents.once('did-fail-load', (_e, code, desc, url) => {
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Cannot load UI',
      message: 'Dev server not reachable',
      detail:
        `Failed to load ${url}\n(${code}: ${desc})\n\n` +
        'On this machine: run `npm run dev` from the project folder, or set:\n' +
        '  ELECTRON_RENDERER_URL=http://<dev-pc-ip>:5173\n' +
        'if Vite runs on another PC (Vite must use host 0.0.0.0).\n\n' +
        'For normal installs use the built app (loads from disk; no dev server).',
    })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
  })

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message} (${sourceId}:${line})`);
  });

  loadRenderer(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── File System IPC Handlers ──────────────────────────────────────────────────

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// Read directory tree
ipcMain.handle('fs:readDir', async (_, dirPath) => {
  const readDir = (p, depth = 0) => {
    if (depth > 6) return []
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true })
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__')
        .map(e => ({
          name: e.name,
          path: path.join(p, e.name),
          isDir: e.isDirectory(),
          children: e.isDirectory() ? readDir(path.join(p, e.name), depth + 1) : null,
        }))
        .sort((a, b) => {
          if (a.isDir && !b.isDir) return -1
          if (!a.isDir && b.isDir) return 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      return []
    }
  }
  return readDir(dirPath)
})

ipcMain.handle('fs:isDirectory', async (_, dirPath) => {
  try {
    return fs.statSync(dirPath).isDirectory()
  } catch {
    return false
  }
})

// Read file content
ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { content, error: null }
  } catch (e) {
    return { content: '', error: e.message }
  }
})

// Save file content
ipcMain.handle('fs:saveFile', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Create new file
ipcMain.handle('fs:createFile', async (_, filePath) => {
  try {
    fs.writeFileSync(filePath, '', 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Create new directory
ipcMain.handle('fs:createDirectory', async (_, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Delete file
ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  try {
    fs.unlinkSync(filePath)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Rename file
ipcMain.handle('fs:renameFile', async (_, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Window controls
ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.isMaximized() ? win.unmaximize() : win?.maximize()
})
ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close())
