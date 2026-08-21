import { computeHistoryStreak } from './historyStreak'

const makeHistory = (dates: string[]) =>
  dates.map((createDate) => ({
    createDate: new Date(createDate).getTime(),
    plan: 68,
    count: 1,
    status: 'start'
  }))

describe('computeHistoryStreak', () => {
  it('returns 0 for empty history', () => {
    expect(computeHistoryStreak([])).toBe(0)
  })

  it('counts today as a 1-day streak', () => {
    const today = new Date().toISOString()
    expect(computeHistoryStreak(makeHistory([today]))).toBe(1)
  })

  it('counts consecutive days including today', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const history = makeHistory([today.toISOString(), yesterday.toISOString()])
    expect(computeHistoryStreak(history)).toBe(2)
  })

  it('counts consecutive days ending yesterday when today is missing', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)
    const history = makeHistory([
      yesterday.toISOString(),
      dayBefore.toISOString()
    ])
    expect(computeHistoryStreak(history)).toBe(2)
  })

  it('breaks streak on a gap', () => {
    const today = new Date()
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const history = makeHistory([today.toISOString(), twoDaysAgo.toISOString()])
    expect(computeHistoryStreak(history)).toBe(1)
  })

  it('deduplicates multiple entries on the same day', () => {
    const today = new Date().toISOString()
    const history = makeHistory([today, today])
    expect(computeHistoryStreak(history)).toBe(1)
  })
})
