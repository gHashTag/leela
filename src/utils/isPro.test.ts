import { isPro } from './isPro'
import { UserT } from '../types/types'

const base: UserT = {
  email: 'a@b.c',
  finish: false,
  firstGame: true,
  firstName: 'A',
  lastName: 'B',
  lastStepTime: 0,
  owner: 'x',
  plan: 68,
  start: false,
  history: [],
  isReported: true
}

describe('isPro', () => {
  it('returns false for null/undefined', () => {
    expect(isPro(null as any)).toBe(false)
    expect(isPro(undefined)).toBe(false)
  })

  it('returns false for a regular user', () => {
    expect(isPro({ ...base, status: null })).toBe(false)
  })

  it('returns false for banned users', () => {
    expect(isPro({ ...base, status: 'ban' })).toBe(false)
  })

  it('returns true for Admin and Free statuses', () => {
    expect(isPro({ ...base, status: 'Admin' })).toBe(true)
    expect(isPro({ ...base, status: 'Free' })).toBe(true)
  })
})
