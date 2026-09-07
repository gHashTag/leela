import { companionRequest } from './companionRequest'

describe('companion request budget', () => {
  it('keeps the latest question verbatim while dropping old oversized context', () => {
    const result = companionRequest([
      { role: 'system', content: 'canonical teaching' },
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'a'.repeat(5000) },
      { role: 'user', content: 'Мой вопрос' }
    ])
    expect(result).toEqual({
      system: 'canonical teaching',
      question: 'Мой вопрос'
    })
  })
  it('retains roles for recent context within the server limit', () => {
    expect(
      companionRequest([
        { role: 'user', content: 'before' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'now' }
      ]).question
    ).toBe('user: before\n\nassistant: answer\n\nuser: now')
  })
  it('accepts the exact limit without adding role overhead', () => {
    expect(
      companionRequest([{ role: 'user', content: 'x'.repeat(5000) }]).question
        .length
    ).toBe(5000)
  })
  it('rejects rather than truncates an oversized question or system prompt', () => {
    expect(() =>
      companionRequest([{ role: 'user', content: 'x'.repeat(5001) }])
    ).toThrow('5000')
    expect(() =>
      companionRequest([
        { role: 'system', content: 'x'.repeat(8001) },
        { role: 'user', content: 'hi' }
      ])
    ).toThrow('8000')
    expect(() =>
      companionRequest([{ role: 'assistant', content: 'answer' }])
    ).toThrow('question')
  })
})
import { it } from '@jest/globals'
