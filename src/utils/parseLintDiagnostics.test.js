import { describe, it, expect } from 'vitest'
import { parseLintDiagnostics } from './parseLintDiagnostics'

describe('parseLintDiagnostics', () => {
  it('parses eslint unix path:line:col:message', () => {
    const raw = 'src/App.jsx:10:5: error Missing semicolon'
    const d = parseLintDiagnostics(raw, '/proj')
    expect(d).toHaveLength(1)
    expect(d[0].line).toBe(10)
    expect(d[0].column).toBe(5)
    expect(d[0].message).toContain('Missing semicolon')
    expect(d[0].path.replace(/\\/g, '/')).toContain('/proj/src/App.jsx')
  })

  it('parses TypeScript error line', () => {
    const raw = 'src/foo.ts(12,3): error TS2322: Type X is not assignable'
    const d = parseLintDiagnostics(raw, '')
    expect(d).toHaveLength(1)
    expect(d[0].line).toBe(12)
    expect(d[0].column).toBe(3)
    expect(d[0].severity).toBe('error')
  })

  it('parses eslint stylish indented block', () => {
    const raw = [
      'src/a.js',
      '  1:2  error  Use strict  semi',
    ].join('\n')
    const d = parseLintDiagnostics(raw, '/root')
    expect(d.length).toBeGreaterThanOrEqual(1)
    expect(d[0].message).toMatch(/strict/i)
  })

  it('dedupes identical diagnostics', () => {
    const raw = 'x.js:1:2: error A\nx.js:1:2: error A'
    const d = parseLintDiagnostics(raw, '')
    expect(d).toHaveLength(1)
  })
})
