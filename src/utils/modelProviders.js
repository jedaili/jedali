const LS_PROVIDERS = 'myAiDesktop.providers'
const LS_ACTIVE_PROVIDER = 'myAiDesktop.activeProviderId'

export const DEFAULT_LOCAL_PROVIDER = {
  id: 'local-default',
  type: 'local',
  name: 'My_ai (Local)',
  apiKey: '',
  apiBase: 'http://127.0.0.1:8000',
  modelName: ''
}

export const DEFAULT_OLLAMA_PROVIDER = {
  id: 'ollama-default',
  type: 'ollama',
  name: 'Ollama (Local)',
  apiKey: '',
  apiBase: 'http://127.0.0.1:11434',
  modelName: 'llama3'
}

function migrateOldSettings() {
  const oldBase = localStorage.getItem('myAiDesktop.apiBase')
  const oldKey = localStorage.getItem('myAiDesktop.apiKey')
  
  if (oldBase || oldKey) {
    return {
      ...DEFAULT_LOCAL_PROVIDER,
      apiBase: oldBase || DEFAULT_LOCAL_PROVIDER.apiBase,
      apiKey: oldKey || DEFAULT_LOCAL_PROVIDER.apiKey,
      name: 'My_ai (Migrated)'
    }
  }
  return null
}

export function getProviders() {
  try {
    const data = localStorage.getItem(LS_PROVIDERS)
    if (data) {
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (_) {}
  
  // Initialize with migrated or default
  const migrated = migrateOldSettings()
  const defaultList = migrated ? [migrated] : [DEFAULT_LOCAL_PROVIDER]
  try {
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(defaultList))
  } catch (_) {}
  return defaultList
}

export function saveProvider(provider) {
  const providers = getProviders()
  if (!provider.id) {
    provider.id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  const idx = providers.findIndex(p => p.id === provider.id)
  if (idx >= 0) {
    providers[idx] = provider
  } else {
    providers.push(provider)
  }
  try {
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(providers))
  } catch (_) {}
  return providers
}

export function deleteProvider(id) {
  let providers = getProviders()
  providers = providers.filter(p => p.id !== id)
  if (providers.length === 0) {
    providers.push(DEFAULT_LOCAL_PROVIDER)
  }
  try {
    localStorage.setItem(LS_PROVIDERS, JSON.stringify(providers))
  } catch (_) {}
  
  // If active provider is deleted, fallback to the first one
  if (getActiveProviderId() === id) {
    setActiveProviderId(providers[0].id)
  }
  
  return providers
}

export function getActiveProviderId() {
  try {
    const id = localStorage.getItem(LS_ACTIVE_PROVIDER)
    if (id) {
      const providers = getProviders()
      if (providers.some(p => p.id === id)) {
        return id
      }
    }
  } catch (_) {}
  return getProviders()[0].id
}

export function setActiveProviderId(id) {
  try {
    localStorage.setItem(LS_ACTIVE_PROVIDER, id)
  } catch (_) {}
}

export function getActiveProvider() {
  const id = getActiveProviderId()
  const providers = getProviders()
  return providers.find(p => p.id === id) || providers[0]
}

/**
 * Discover available Ollama models by querying the Ollama API.
 * Returns array of model objects: { name, size, modified_at }
 */
export async function discoverOllamaModels(apiBase = 'http://127.0.0.1:11434') {
  const base = String(apiBase || 'http://127.0.0.1:11434').trim().replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data.models || []).map(m => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    }))
  } catch (e) {
    throw new Error(`Cannot reach Ollama at ${base}: ${e.message}`)
  }
}
