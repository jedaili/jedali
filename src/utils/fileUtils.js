const EXT_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift',
  kt: 'kotlin', scala: 'scala', r: 'r', lua: 'lua', dart: 'dart',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass',
  less: 'less', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  xml: 'xml', svg: 'xml', md: 'markdown', txt: 'plaintext',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', bat: 'bat',
  sql: 'sql', graphql: 'graphql', dockerfile: 'dockerfile',
  ini: 'ini', env: 'plaintext', gitignore: 'plaintext',
  vue: 'html', svelte: 'html',
}

export function getLanguage(filename = '') {
  const name = filename.toLowerCase()
  const ext = name.split('.').pop()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'makefile'
  return EXT_MAP[ext] ?? 'plaintext'
}

export function getFileIcon(filename = '', isDir = false) {
  if (isDir) return '📁'
  const ext = filename.split('.').pop().toLowerCase()
  const icons = {
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    py: '🐍', rb: '💎', go: '🐹', rs: '🦀',
    html: '🌐', css: '🎨', scss: '🎨',
    json: '📋', yaml: '📋', yml: '📋',
    md: '📝', txt: '📄', sh: '⚙️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    pdf: '📕', zip: '📦', tar: '📦', gz: '📦',
    env: '🔐', gitignore: '🚫',
    sql: '🗄️', dockerfile: '🐳',
  }
  return icons[ext] ?? '📄'
}

export function isTextFile(filename = '') {
  const BINARY_EXT = ['png','jpg','jpeg','gif','webp','ico','bmp','svg',
    'pdf','zip','tar','gz','7z','rar','exe','dll','so','dylib','woff','woff2','ttf','otf',
    'mp3','mp4','wav','avi','mov','mkv','db','sqlite','bin','pyc','class']
  const ext = filename.split('.').pop().toLowerCase()
  return !BINARY_EXT.includes(ext)
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
