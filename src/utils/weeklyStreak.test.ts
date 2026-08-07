import { getWeekSummary } from './weeklyStreak'
import { JournalEntry, getLocalDateString } from '../components/StreakJournal'

const t = (key: string) => key

describe('getWeekSummary', () => {
  it('returns zero streak and inactive week when there are no entries', () => {
    const result = getWeekSummary([], t, new Date(2026, 0, 7))
    expect(result.streak).toBe(0)
    expect(result.week.every((day) => !day.active)).toBe(true)
    expect(result.week.map((day) => day.label)).toEqual([
      'weeklyStreak.sun',
      'weeklyStreak.mon',
      'weeklyStreak.tue',
      'weeklyStreak.wed',
      'weeklyStreak.thu',
      'weeklyStreak.fri',
      'weeklyStreak.sat'
    ])
  })

  it('marks today active in the weekly view', () => {
    const today = new Date(2026, 0, 7)
    const entries: JournalEntry[] = [
      { date: getLocalDateString(today), text: 'entry' }
    ]
    const result = getWeekSummary(entries, t, today)
    expect(result.streak).toBe(1)
    expect(result.week[3].active).toBe(true)
  })

  it('marks a previous day active while keeping the rest inactive', () => {
    const today = new Date(2026, 0, 7)
    const lastSunday = new Date(2026, 0, 4)
    const entries: JournalEntry[] = [
      { date: getLocalDateString(lastSunday), text: 'entry' }
    ]
    const result = getWeekSummary(entries, t, today)
    expect(result.week[0].active).toBe(true)
    const activeCount = result.week.filter((d) => d.active).length
    expect(activeCount).toBe(1)
  })
})
