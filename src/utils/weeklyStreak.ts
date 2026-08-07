import { JournalEntry, getLocalDateString } from '../components/StreakJournal'

export interface WeekDay {
  label: string
  active: boolean
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const getWeekSummary = (
  entries: JournalEntry[],
  t: (key: string) => string,
  referenceDate = new Date()
): { streak: number; week: WeekDay[] } => {
  const dates = new Set(entries.map((entry) => entry.date))
  const today = getLocalDateString(referenceDate)
  const cursor = new Date(referenceDate)

  if (!dates.has(today)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (dates.has(getLocalDateString(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const startOfWeek = new Date(referenceDate)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  const week: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    week.push({
      label: t(`weeklyStreak.${DAY_KEYS[i]}`),
      active: dates.has(getLocalDateString(d))
    })
  }

  return { streak, week }
}
