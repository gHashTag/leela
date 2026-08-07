import { JournalEntry, computeStreak, getLocalDateString } from './index'

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
