import { getDayOfYear, getVerseOfTheDay } from './dailyVerse'

describe('dailyVerse helpers', () => {
  const verses = [
    { quote: 'A', source: 'B', reflection: 'C' },
    { quote: 'D', source: 'E', reflection: 'F' }
  ]

  it('computes day of year for Jan 1', () => {
    const date = new Date(2026, 0, 1)
    expect(getDayOfYear(date)).toBe(1)
  })

  it('computes day of year for Dec 31', () => {
    const date = new Date(2026, 11, 31)
    expect(getDayOfYear(date)).toBe(365)
  })

  it('returns null when no verses exist', () => {
    const t = () => []
    expect(getVerseOfTheDay(t as any)).toBeNull()
  })

  it('picks the verse matching the day of year', () => {
    const t = () => verses
    const date = new Date(2026, 0, 2)
    expect(getVerseOfTheDay(t as any, date)).toEqual(verses[0])
  })

  it('wraps around when day exceeds verse count', () => {
    const t = () => verses
    const date = new Date(2026, 0, 3)
    expect(getVerseOfTheDay(t as any, date)).toEqual(verses[1])
  })
})
