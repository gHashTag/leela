import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  formatCountdown,
  getTimeLeft,
  getTrialDeadline,
  resetTrialDeadline
} from './trialTimer'

const mockT = (key: string, options?: any) => {
  if (key === 'trialTimer.expired') return 'Offer expired'
  if (key === 'trialTimer.endsInDays') {
    return `Ends in ${options.days}d ${options.hours}h ${options.minutes}m`
  }
  if (key === 'trialTimer.endsIn') {
    return `Ends in ${options.hours}:${options.minutes}:${options.seconds}`
  }
  return key
}

beforeEach(() => {
  AsyncStorage.clear()
})

describe('trialTimer', () => {
  it('computes time left from a future deadline', () => {
    const deadline = Date.now() + 3661000 // 1h 1m 1s
    const left = getTimeLeft(deadline)
    expect(left.hours).toBeGreaterThanOrEqual(0)
    expect(left.minutes).toBeGreaterThanOrEqual(0)
    expect(left.seconds).toBeGreaterThanOrEqual(0)
    expect(left.expired).toBe(false)
  })

  it('marks a past deadline as expired', () => {
    const left = getTimeLeft(Date.now() - 1000)
    expect(left.expired).toBe(true)
    expect(left.total).toBe(0)
  })

  it('formats short countdown without days', () => {
    const left = getTimeLeft(Date.now() + 3661000)
    expect(formatCountdown(left, mockT, true)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('formats short countdown with days', () => {
    const left = getTimeLeft(Date.now() + 90061000) // 1d 1h 1m 1s
    expect(formatCountdown(left, mockT, true)).toBe('01:01:01')
  })

  it('formats expired state', () => {
    const left = getTimeLeft(Date.now() - 1000)
    expect(formatCountdown(left, mockT)).toBe('Offer expired')
  })

  it('creates a deadline 24h in the future when none is stored', async () => {
    const deadline = await getTrialDeadline()
    expect(deadline).toBeGreaterThan(Date.now())
    expect(deadline).toBeLessThanOrEqual(
      Date.now() + 24 * 60 * 60 * 1000 + 1000
    )
  })

  it('returns the same stored deadline on subsequent calls', async () => {
    const first = await getTrialDeadline()
    const second = await getTrialDeadline()
    expect(second).toBe(first)
  })

  it('resets the deadline', async () => {
    await getTrialDeadline()
    const reset = await resetTrialDeadline(1)
    expect(reset).toBeGreaterThan(Date.now())
    expect(reset).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000 + 1000)
  })
})
