import { isAiComment } from './aiComment'

jest.mock('@env', () => ({ LEELA_ID: 'leela-ai-id' }))

describe('isAiComment', () => {
  it('returns true for the Leela AI owner id', () => {
    expect(isAiComment('leela-ai-id')).toBe(true)
  })

  it('returns false for a regular user id', () => {
    expect(isAiComment('regular-user-id')).toBe(false)
  })
})
