const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // File System
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  isDirectory: (path) => ipcRenderer.invoke('fs:isDirectory', path),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  saveFile: (path, content) => ipcRenderer.invoke('fs:saveFile', path, content),
  createFile: (path) => ipcRenderer.invoke('fs:createFile', path),
  createDirectory: (path) => ipcRenderer.invoke('fs:createDirectory', path),
  deleteFile: (path) => ipcRenderer.invoke('fs:deleteFile', path),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Workspace / IDE
  listWorkspaceFiles: (roots) => ipcRenderer.invoke('workspace:listFiles', roots),
  searchInWorkspace: (payload) => ipcRenderer.invoke('workspace:search', payload),
  gitWorkspaceInfo: (cwd) => ipcRenderer.invoke('git:workspaceInfo', cwd),
  gitExec: (payload) => ipcRenderer.invoke('git:exec', payload),
  workspaceSetWatchRoots: (roots) => ipcRenderer.invoke('workspace:setWatchRoots', roots),
  onWorkspaceFsChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('workspace:fsChanged', listener)
    return () => ipcRenderer.removeListener('workspace:fsChanged', listener)
  },
  shellExec: (payload) => ipcRenderer.invoke('shell:exec', payload),

  /** My_ai HTTP via main process (no browser CORS). */
  myAiFetch: (opts) => ipcRenderer.invoke('myai:fetch', opts),

  // Interactive terminal (node-pty when rebuilt; else piped shell + xterm)
  ptySpawn: (opts) => ipcRenderer.invoke('pty:spawn', opts),
  ptyWrite: (data) => ipcRenderer.send('pty:write', data),
  ptyResize: (cols, rows) => ipcRenderer.invoke('pty:resize', { cols, rows }),
  ptyKill: () => ipcRenderer.invoke('pty:kill'),
  ptyCapabilities: () => ipcRenderer.invoke('pty:capabilities'),
  onPtyData: (callback) => {
    const listener = (_e, data) => callback(data)
    ipcRenderer.on('pty:data', listener)
    return () => ipcRenderer.removeListener('pty:data', listener)
  },
  onPtyExit: (callback) => {
    const listener = (_e, payload) => callback(payload)
    ipcRenderer.on('pty:exit', listener)
    return () => ipcRenderer.removeListener('pty:exit', listener)
  },
})
