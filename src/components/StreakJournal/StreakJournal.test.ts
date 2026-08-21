import {
  JournalEntry,
  canRecoverStreak,
  computeStreak,
  getLocalDateString
} from './index'

describe('computeStreak', () => {
  const today = getLocalDateString(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)

  it('returns 0 when there are no entries', () => {
    expect(computeStreak([])).toBe(0)
  })

  it('counts today as a 1-day streak', () => {
    const entries: JournalEntry[] = [{ date: today, text: 'entry' }]
    expect(computeStreak(entries)).toBe(1)
  })

  it('counts consecutive days including yesterday when today is missing', () => {
    const entries: JournalEntry[] = [{ date: yesterday, text: 'entry' }]
    expect(computeStreak(entries)).toBe(1)
  })

  it('counts multiple consecutive days', () => {
    const entries: JournalEntry[] = []
    for (let i = 0; i < 5; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      entries.push({ date: getLocalDateString(date), text: `day ${i}` })
    }
    expect(computeStreak(entries)).toBe(5)
  })

  it('stops counting when a gap appears', () => {
    const gapDate = new Date()
    gapDate.setDate(gapDate.getDate() - 2)
    const entries: JournalEntry[] = [
      { date: today, text: 'today' },
      { date: getLocalDateString(gapDate), text: 'two days ago' }
    ]
    expect(computeStreak(entries)).toBe(1)
  })
})

describe('canRecoverStreak', () => {
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)
  const dayBeforeYesterdayDate = new Date()
  dayBeforeYesterdayDate.setDate(dayBeforeYesterdayDate.getDate() - 2)
  const dayBeforeYesterday = getLocalDateString(dayBeforeYesterdayDate)
  const threeDaysAgoDate = new Date()
  threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3)
  const threeDaysAgo = getLocalDateString(threeDaysAgoDate)
  const eightDaysAgoDate = new Date()
  eightDaysAgoDate.setDate(eightDaysAgoDate.getDate() - 8)
  const eightDaysAgo = getLocalDateString(eightDaysAgoDate)

  it('returns true when yesterday is missed and recovery is available', () => {
    const entries: JournalEntry[] = [
      { date: dayBeforeYesterday, text: 'entry' },
      { date: threeDaysAgo, text: 'entry' }
    ]
    expect(canRecoverStreak(entries, null)).toBe(true)
  })

  it('returns false when yesterday has an entry', () => {
    const entries: JournalEntry[] = [
      { date: yesterday, text: 'entry' },
      { date: dayBeforeYesterday, text: 'entry' }
    ]
    expect(canRecoverStreak(entries, null)).toBe(false)
  })

  it('returns false when there is no streak to recover', () => {
    const entries: JournalEntry[] = [{ date: threeDaysAgo, text: 'entry' }]
    expect(canRecoverStreak(entries, null)).toBe(false)
  })

  it('returns false when recovery was used within the last 7 days', () => {
    const entries: JournalEntry[] = [
      { date: dayBeforeYesterday, text: 'entry' }
    ]
    const lastRecovery = getLocalDateString(new Date())
    expect(canRecoverStreak(entries, lastRecovery)).toBe(false)
  })

  it('returns true when recovery was used 8 days ago', () => {
    const entries: JournalEntry[] = [
      { date: dayBeforeYesterday, text: 'entry' }
    ]
    expect(canRecoverStreak(entries, eightDaysAgo)).toBe(true)
  })
})
