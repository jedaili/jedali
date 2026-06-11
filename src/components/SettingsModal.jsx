import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check, AlertCircle, Cpu, RefreshCw, ChevronDown } from 'lucide-react'
import { getProviders, saveProvider, deleteProvider, getActiveProviderId, setActiveProviderId, discoverOllamaModels } from '../utils/modelProviders'
import { testProviderConnection } from '../utils/aiApi'

export default function SettingsModal({ onClose, onProvidersChange }) {
  const [providers, setProviders] = useState([])
  const [activeId, setActiveId] = useState('')
  const [editingProvider, setEditingProvider] = useState(null)
  const [inlineEnabled, setInlineEnabled] = useState(false)
  
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaDiscovering, setOllamaDiscovering] = useState(false)
  const [ollamaDiscoverError, setOllamaDiscoverError] = useState(null)

  useEffect(() => {
    loadProviders()
    setInlineEnabled(localStorage.getItem('myAiDesktop.inlineCompletionsEnabled') === 'true')
  }, [])

  const loadProviders = () => {
    setProviders(getProviders())
    setActiveId(getActiveProviderId())
  }

  const handleSaveProvider = () => {
    if (!editingProvider.name.trim()) {
      alert("Please enter a display name")
      return
    }
    saveProvider(editingProvider)
    loadProviders()
    setEditingProvider(null)
    setTestResult(null)
    setOllamaModels([])
    setOllamaDiscoverError(null)
    if (onProvidersChange) onProvidersChange()
  }

  const handleDeleteProvider = (id) => {
    if (confirm('Delete this provider?')) {
      deleteProvider(id)
      loadProviders()
      if (editingProvider?.id === id) {
        setEditingProvider(null)
        setTestResult(null)
      }
      if (onProvidersChange) onProvidersChange()
    }
  }

  const handleSetActive = (id) => {
    setActiveProviderId(id)
    setActiveId(id)
    if (onProvidersChange) onProvidersChange()
  }

  const handleToggleInline = (e) => {
    const checked = e.target.checked
    setInlineEnabled(checked)
    localStorage.setItem('myAiDesktop.inlineCompletionsEnabled', checked ? 'true' : 'false')
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testProviderConnection(editingProvider)
      setTestResult(res)
    } catch (e) {
      setTestResult({ ok: false, message: e.message || String(e) })
    } finally {
      setTesting(false)
    }
  }

  const handleDiscoverOllama = async () => {
    setOllamaDiscovering(true)
    setOllamaDiscoverError(null)
    setOllamaModels([])
    try {
      const base = editingProvider?.apiBase || 'http://127.0.0.1:11434'
      const models = await discoverOllamaModels(base)
      setOllamaModels(models)
      if (models.length > 0 && !editingProvider.modelName) {
        setEditingProvider(p => ({ ...p, modelName: models[0].name }))
      }
    } catch (e) {
      setOllamaDiscoverError(e.message)
    } finally {
      setOllamaDiscovering(false)
    }
  }

  const getProviderTypeIcon = (type) => {
    const icons = {
      local: '🏠',
      openai: '🤖',
      anthropic: '🎭',
      gemini: '✨',
      ollama: '🦙',
    }
    return icons[type] || '🔌'
  }

  const renderEditForm = () => {
    if (!editingProvider) return null
    const isOllama = editingProvider.type === 'ollama'
    
    return (
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-0)', fontWeight: 600 }}>
          {editingProvider.id ? 'Edit Provider' : 'Add Provider'}
        </h3>
        
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Provider Type</label>
          <select 
            value={editingProvider.type}
            onChange={e => setEditingProvider({...editingProvider, type: e.target.value, modelName: ''})}
            style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
          >
            <option value="local">🏠 Local AI (My_ai)</option>
            <option value="ollama">🦙 Ollama (Local LLMs)</option>
            <option value="openai">🤖 OpenAI</option>
            <option value="anthropic">🎭 Anthropic</option>
            <option value="gemini">✨ Google Gemini</option>
          </select>
        </div>

        {/* Ollama banner */}
        {isOllama && (
          <div style={{
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(124, 106, 247, 0.08), rgba(62, 207, 207, 0.06))',
            border: '1px solid rgba(62, 207, 207, 0.2)',
            borderRadius: 'var(--radius)',
            fontSize: 11,
            color: 'var(--text-2)',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--accent-2)', display: 'block', marginBottom: 4 }}>🦙 Ollama — نماذج محلية مجانية</strong>
            تأكد من تشغيل Ollama: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-4)', padding: '1px 5px', borderRadius: 3 }}>ollama serve</code>
            <br />
            ثم حمّل نموذجاً مثل: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-4)', padding: '1px 5px', borderRadius: 3 }}>ollama pull llama3</code>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Display Name</label>
          <input 
            type="text"
            value={editingProvider.name}
            onChange={e => setEditingProvider({...editingProvider, name: e.target.value})}
            placeholder="e.g. Ollama Llama 3"
            style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
          />
        </div>

        {/* Model name field — with Ollama discover button */}
        {editingProvider.type !== 'local' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              Model Name
              {isOllama && (
                <button
                  type="button"
                  onClick={handleDiscoverOllama}
                  disabled={ollamaDiscovering}
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(62, 207, 207, 0.35)',
                    background: 'var(--accent-2-dim)',
                    color: 'var(--accent-2)',
                    cursor: ollamaDiscovering ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={9} style={{ animation: ollamaDiscovering ? 'spin 1s linear infinite' : 'none' }} />
                  {ollamaDiscovering ? 'Discovering…' : 'Discover Models'}
                </button>
              )}
            </label>

            {/* Ollama model dropdown or text input */}
            {isOllama && ollamaModels.length > 0 ? (
              <select
                value={editingProvider.modelName}
                onChange={e => setEditingProvider({...editingProvider, modelName: e.target.value})}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--accent-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
              >
                {ollamaModels.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name}{m.size ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input 
                type="text"
                value={editingProvider.modelName}
                onChange={e => setEditingProvider({...editingProvider, modelName: e.target.value})}
                placeholder={
                  isOllama ? 'llama3, mistral, codellama…' :
                  editingProvider.type === 'openai' ? 'gpt-4o-mini' :
                  editingProvider.type === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
                  'gemini-1.5-flash'
                }
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
              />
            )}

            {/* Ollama discover error */}
            {isOllama && ollamaDiscoverError && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <AlertCircle size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                {ollamaDiscoverError}
              </div>
            )}

            {/* Discovered models count badge */}
            {isOllama && !ollamaDiscoverError && ollamaModels.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4 }}>
                ✓ Found {ollamaModels.length} model{ollamaModels.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* API Key — not needed for Ollama (optional) */}
        {editingProvider.type !== 'ollama' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>API Key</label>
            <input 
              type="password"
              value={editingProvider.apiKey}
              onChange={e => setEditingProvider({...editingProvider, apiKey: e.target.value})}
              placeholder={editingProvider.type === 'local' ? "Optional for local" : "Required"}
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
            />
            {editingProvider.type !== 'local' && (
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={10} /> Keys are stored locally in plain text.
              </div>
            )}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            {editingProvider.type === 'local' ? 'API Base URL' :
             editingProvider.type === 'ollama' ? 'Ollama Base URL' :
             'Custom Endpoint (Optional)'}
          </label>
          <input 
            type="text"
            value={editingProvider.apiBase}
            onChange={e => setEditingProvider({...editingProvider, apiBase: e.target.value})}
            placeholder={
              editingProvider.type === 'local' ? "http://127.0.0.1:8000" :
              editingProvider.type === 'ollama' ? "http://127.0.0.1:11434" :
              "Leave empty for default"
            }
            style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
          />
        </div>

        {testResult && (
          <div style={{
            fontSize: 11, lineHeight: 1.45, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: testResult.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${testResult.ok ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`,
            color: testResult.ok ? 'var(--green)' : 'var(--red)',
          }}>
            {testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 16 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{ padding: '7px 14px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-0)', cursor: testing ? 'wait' : 'pointer' }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { setEditingProvider(null); setTestResult(null); setOllamaModels([]); setOllamaDiscoverError(null) }}
            style={{ padding: '7px 14px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProvider}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 700, height: 520, background: 'var(--bg-1)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 56px rgba(0,0,0,0.55)', display: 'flex', overflow: 'hidden'
        }}
      >
        {/* Left Sidebar: Provider List */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>AI Providers</span>
            <button 
              onClick={() => {
                setEditingProvider({ type: 'ollama', name: 'Ollama', apiKey: '', apiBase: 'http://127.0.0.1:11434', modelName: 'llama3' })
                setTestResult(null)
                setOllamaModels([])
                setOllamaDiscoverError(null)
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4 }}
              title="Add Provider"
            >
              <Plus size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            <div style={{
              padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-3)', border: '1px solid var(--border)'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={inlineEnabled}
                  onChange={handleToggleInline}
                  style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', display: 'block' }}>Enable AI Inline Autocomplete</span>
                  <span style={{ fontSize: 10, color: 'var(--text-2)', display: 'block', marginTop: 4, lineHeight: 1.4 }}>
                    Uses the currently active model. For best performance, choose a fast model like <code>gpt-4o-mini</code> or <code>gemini-1.5-flash</code>.
                  </span>
                </div>
              </label>
            </div>
            
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', padding: '0 4px 6px', marginTop: 8 }}>Available Models</div>

            {providers.map(p => (
              <div 
                key={p.id}
                onClick={() => {
                  setEditingProvider({ ...p })
                  setTestResult(null)
                  setOllamaModels([])
                  setOllamaDiscoverError(null)
                }}
                style={{ 
                  padding: '10px 12px', marginBottom: 6, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: editingProvider?.id === p.id ? 'var(--bg-3)' : 'transparent',
                  border: '1px solid', borderColor: editingProvider?.id === p.id ? 'var(--accent)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {getProviderTypeIcon(p.type)} {p.name}
                  </span>
                  {p.id === activeId && <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize' }}>{p.type}{p.modelName ? ` · ${p.modelName}` : ''}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.id !== activeId && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSetActive(p.id) }}
                        style={{ fontSize: 9, background: 'var(--bg-4)', color: 'var(--text-1)', border: 'none', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Set Active
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteProvider(p.id) }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Edit Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
          
          {editingProvider ? (
            renderEditForm()
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-3)', fontSize: 13 }}>
              <Cpu size={32} style={{ opacity: 0.3 }} />
              <span>Select a provider to edit or</span>
              <button
                onClick={() => {
                  setEditingProvider({ type: 'ollama', name: 'Ollama', apiKey: '', apiBase: 'http://127.0.0.1:11434', modelName: 'llama3' })
                  setTestResult(null)
                }}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  background: 'var(--bg-3)', color: 'var(--text-1)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Add Provider
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
