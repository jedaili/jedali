import { describe, it, expect } from 'vitest'
import { buildChatApiMessages } from './chatHistory'

describe('buildChatApiMessages', () => {
  const welcome = [{ role: 'assistant', content: 'welcome' }]

  it('includes welcome + new user turn on first send', () => {
    const api = buildChatApiMessages(welcome, 'صباح الخير', { isRetry: false })
    expect(api.length).toBeGreaterThan(0)
    expect(api.at(-1)).toEqual({ role: 'user', content: 'صباح الخير' })
  })

  it('never returns an empty array', () => {
    expect(buildChatApiMessages([], 'hello', { isRetry: false })).toEqual([
      { role: 'user', content: 'hello' },
    ])
  })

  it('retry reuses trailing user turn when present', () => {
    const prev = [
      ...welcome,
      { role: 'user', content: 'صباح الخير' },
      { role: 'assistant', content: '⚠️ err', retryUserText: 'صباح الخير' },
    ]
    const api = buildChatApiMessages(prev, 'صباح الخير', { isRetry: true })
    expect(api.at(-1)).toEqual({ role: 'user', content: 'صباح الخير' })
    expect(api.length).toBe(2)
  })

  it('retry appends user when error bubble had no prior user in state', () => {
    const prev = [
      { role: 'assistant', content: '⚠️ err', retryUserText: 'hi' },
    ]
    const api = buildChatApiMessages(prev, 'hi', { isRetry: true })
    expect(api).toEqual([{ role: 'user', content: 'hi' }])
  })
})
