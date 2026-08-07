import { computeStreak, getLocalDateString } from '../components/StreakJournal'
import { HistoryT } from '../types/types'

/**
 * Convert a Leela game history entry into a journal-style date string.
 * The game records timestamps in milliseconds, while the streak helpers
 * expect ISO calendar dates in the user's local timezone.
 */
const historyToDateEntry = (history: HistoryT[]) =>
  history.map((item) => ({
    date: getLocalDateString(new Date(item.createDate))
  }))

/**
 * Compute the current daily streak from a player's game history.
 *
 * A day counts if the player recorded at least one history entry on that
 * calendar date. The streak runs backwards from today (or yesterday if
 * today has no entry) through consecutive active days.
 */
export const computeHistoryStreak = (history: HistoryT[]): number => {
  if (!history || history.length === 0) return 0
  return computeStreak(historyToDateEntry(history))
}
