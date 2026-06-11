const LS_SNIPPETS = 'myAiDesktop.snippets'

export const DEFAULT_SNIPPETS = [
  {
    id: 'snip-react-component',
    title: 'React Functional Component',
    prefix: 'rfc',
    language: 'javascript,typescript',
    body: 'import React from \'react\'\n\nexport default function ${1:ComponentName}() {\n  return (\n    <div>\n      ${2:content}\n    </div>\n  )\n}\n',
  },
  {
    id: 'snip-console-log',
    title: 'Console Log',
    prefix: 'clg',
    language: '*',
    body: 'console.log(${1:variable})',
  }
]

export function getSnippets() {
  try {
    const data = localStorage.getItem(LS_SNIPPETS)
    if (data) {
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (_) {}
  
  // Initialize default snippets if none exist
  try {
    localStorage.setItem(LS_SNIPPETS, JSON.stringify(DEFAULT_SNIPPETS))
  } catch (_) {}
  return DEFAULT_SNIPPETS
}

export function saveSnippet(snippet) {
  const snippets = getSnippets()
  if (!snippet.id) {
    snippet.id = 'snip-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  const idx = snippets.findIndex(s => s.id === snippet.id)
  if (idx >= 0) {
    snippets[idx] = snippet
  } else {
    snippets.push(snippet)
  }
  try {
    localStorage.setItem(LS_SNIPPETS, JSON.stringify(snippets))
  } catch (_) {}
  
  // Fire event so EditorArea can reload snippets if it's open
  window.dispatchEvent(new Event('myai-snippets-changed'))
  
  return snippets
}

export function deleteSnippet(id) {
  let snippets = getSnippets()
  snippets = snippets.filter(s => s.id !== id)
  try {
    localStorage.setItem(LS_SNIPPETS, JSON.stringify(snippets))
  } catch (_) {}
  
  window.dispatchEvent(new Event('myai-snippets-changed'))
  
  return snippets
}
