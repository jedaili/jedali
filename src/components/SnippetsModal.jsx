import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check, Scissors } from 'lucide-react'
import { getSnippets, saveSnippet, deleteSnippet } from '../utils/snippets'

export default function SnippetsModal({ onClose }) {
  const [snippets, setSnippets] = useState([])
  const [editingSnippet, setEditingSnippet] = useState(null)

  useEffect(() => {
    setSnippets(getSnippets())
  }, [])

  const handleSave = () => {
    if (!editingSnippet.title.trim() || !editingSnippet.prefix.trim() || !editingSnippet.body.trim()) {
      alert("Please fill in the title, prefix, and body.")
      return
    }
    const updated = saveSnippet(editingSnippet)
    setSnippets(updated)
    setEditingSnippet(null)
  }

  const handleDelete = (id) => {
    if (confirm('Delete this snippet?')) {
      const updated = deleteSnippet(id)
      setSnippets(updated)
      if (editingSnippet?.id === id) {
        setEditingSnippet(null)
      }
    }
  }

  const renderEditForm = () => {
    if (!editingSnippet) return null
    return (
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-0)', fontWeight: 600 }}>
          {editingSnippet.id ? 'Edit Snippet' : 'Add Snippet'}
        </h3>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Title</label>
          <input 
            type="text"
            value={editingSnippet.title}
            onChange={e => setEditingSnippet({...editingSnippet, title: e.target.value})}
            placeholder="e.g. React Component"
            style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Prefix</label>
            <input 
              type="text"
              value={editingSnippet.prefix}
              onChange={e => setEditingSnippet({...editingSnippet, prefix: e.target.value})}
              placeholder="e.g. rfc"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Language (comma-separated or *)</label>
            <input 
              type="text"
              value={editingSnippet.language}
              onChange={e => setEditingSnippet({...editingSnippet, language: e.target.value})}
              placeholder="e.g. javascript,typescript or *"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-0)', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            Body (Use $1, $2 for cursor positions)
          </label>
          <textarea 
            value={editingSnippet.body}
            onChange={e => setEditingSnippet({...editingSnippet, body: e.target.value})}
            placeholder="console.log($1)"
            style={{ 
              flex: 1, width: '100%', padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', 
              background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', 
              color: 'var(--text-0)', outline: 'none', resize: 'none', minHeight: 150 
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 16 }}>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setEditingSnippet(null)}
            style={{ padding: '7px 14px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
          >
            Save Snippet
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
        {/* Left Sidebar: Snippets List */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Code Snippets</span>
            <button 
              onClick={() => setEditingSnippet({ title: '', prefix: '', language: '*', body: '' })}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4 }}
              title="Add Snippet"
            >
              <Plus size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {snippets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 12 }}>
                No snippets found.
              </div>
            ) : snippets.map(s => (
              <div 
                key={s.id}
                onClick={() => setEditingSnippet({ ...s })}
                style={{ 
                  padding: '10px 12px', marginBottom: 6, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: editingSnippet?.id === s.id ? 'var(--bg-3)' : 'transparent',
                  border: '1px solid', borderColor: editingSnippet?.id === s.id ? 'var(--accent)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>{s.title}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{s.prefix} <span style={{ opacity: 0.5 }}>({s.language})</span></span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}
                  >
                    <Trash2 size={12} />
                  </button>
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
          
          {editingSnippet ? (
            renderEditForm()
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-3)', fontSize: 13 }}>
              <Scissors size={32} style={{ opacity: 0.3 }} />
              <span>Select a snippet to edit or</span>
              <button
                onClick={() => setEditingSnippet({ title: '', prefix: '', language: '*', body: '' })}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  background: 'var(--bg-3)', color: 'var(--text-1)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Add Snippet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
