import { TFunction } from 'i18next'

export interface Verse {
  quote: string
  source: string
  reflection: string
}

export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function getVerseOfTheDay(
  t: TFunction,
  date = new Date()
): Verse | null {
  const verses = (t('dailyVerse.verses', { returnObjects: true }) || []) as
    | Verse[]
    | null

  if (!Array.isArray(verses) || verses.length === 0) return null
  return verses[getDayOfYear(date) % verses.length]
}
