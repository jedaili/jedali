import React, { useState, useEffect } from 'react'
import { FileText, Folder, Sparkles, Clock, LayoutDashboard, Loader2, Info } from 'lucide-react'
import { sendMessage } from '../utils/aiApi'
import { getLanguage, getFileIcon } from '../utils/fileUtils'

function simpleMarkdownToHtml(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3 style="margin-top:1em;margin-bottom:0.5em;color:var(--text-1)">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin-top:1em;margin-bottom:0.5em;color:var(--text-0)">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin-top:1em;margin-bottom:0.5em;color:var(--text-0)">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--bg-3);padding:2px 4px;border-radius:4px;font-family:var(--font-mono);font-size:0.9em;color:var(--accent-2)">$1</code>')
    .replace(/^\- (.*$)/gim, '<li style="margin-left:20px;margin-bottom:4px">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
  return html
}

export default function ProjectDashboard({ folders = [], recentFiles = [], onOpenFile, workspaceRoots = [] }) {
  const [summary, setSummary] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState(null)

  const isElectron = !!window.electron

  const numFiles = folders.filter(f => !f.isDir).length
  const numDirs = folders.filter(f => f.isDir).length
  
  const generateSummary = async () => {
    if (!isElectron) {
      setError('AI summary requires electron environment to read files.')
      return
    }

    setLoadingSummary(true)
    setError(null)

    try {
      // Find README.md or package.json
      let targetFile = folders.find(f => f.name.toLowerCase() === 'readme.md')
      if (!targetFile) {
        targetFile = folders.find(f => f.name.toLowerCase() === 'package.json')
      }

      if (!targetFile) {
        setError('No README.md or package.json found to summarize.')
        setLoadingSummary(false)
        return
      }

      const { content, error: readError } = await window.electron.readFile(targetFile.path)
      if (readError || !content) {
        setError('Failed to read file: ' + readError)
        setLoadingSummary(false)
        return
      }

      const prompt = `You are a helpful assistant. Provide a concise, highly readable summary of the following project based on its ${targetFile.name}. 
Focus on: What it does, core technologies, and main purpose. Use markdown with bullet points. Do not make it too long.

Content of ${targetFile.name}:
${content.slice(0, 4000)}`

      const response = await sendMessage([{ role: 'user', content: prompt }])
      setSummary(response)
    } catch (err) {
      setError('AI Summary failed: ' + err.message)
    } finally {
      setLoadingSummary(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', overflowY: 'auto' }}>
      <div style={{ padding: '40px 60px', maxWidth: 1000, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px var(--accent-dim)' }}>
            <LayoutDashboard size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>Project Dashboard</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
              {workspaceRoots[0] ? workspaceRoots[0] : 'No workspace loaded'}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          
          {/* Stats Card */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} /> Workspace Stats
            </h3>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: 1, background: 'var(--bg-2)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-0)' }}>{numFiles}</span>
                <span style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Files</span>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-2)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Folder size={24} style={{ color: 'var(--accent-2)', marginBottom: 8 }} />
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-0)' }}>{numDirs}</span>
                <span style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Folders</span>
              </div>
            </div>
          </div>

          {/* AI Summary Card */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} /> AI Project Summary
              </h3>
              {!summary && (
                <button
                  type="button"
                  onClick={generateSummary}
                  disabled={loadingSummary || folders.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    fontSize: 11, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none',
                    background: 'var(--accent)', color: '#fff', cursor: loadingSummary ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loadingSummary ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  {loadingSummary ? 'Generating...' : 'Generate Summary'}
                </button>
              )}
            </div>
            
            <div style={{ 
              flex: 1, background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', 
              padding: summary ? 16 : 30, display: 'flex', flexDirection: 'column', 
            }}>
              {summary ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(summary) }}
                  style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-0)' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, margin: 'auto' }}>
                  {error ? <span style={{ color: 'var(--red)' }}>{error}</span> : 'Click generate to analyze the project based on README.md or package.json.'}
                </div>
              )}
            </div>
          </div>

          {/* Recent Files */}
          <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, gridColumn: 'span 3' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} /> Recent Files
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentFiles.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12, background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)' }}>
                  No recent files yet. Open some files to see them here!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                  {recentFiles.map((file, idx) => (
                    <button
                      key={`${file.path}-${idx}`}
                      type="button"
                      onClick={() => onOpenFile(file.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-0)', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <span style={{ fontSize: 16 }}>{getFileIcon(file.name)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.path.split(/[/\\]/).slice(-3, -1).join('/') || '/'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
