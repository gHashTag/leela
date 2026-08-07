import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const TRIAL_DEADLINE_KEY = '@trialDeadline'
const DEFAULT_TRIAL_HOURS = 24

export interface TimeLeftT {
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

/**
 * Split remaining milliseconds into days/hours/minutes/seconds.
 */
export const getTimeLeft = (deadline: number): TimeLeftT => {
  const total = Math.max(0, deadline - Date.now())
  const seconds = Math.floor((total / 1000) % 60)
  const minutes = Math.floor((total / (1000 * 60)) % 60)
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24)
  const days = Math.floor(total / (1000 * 60 * 60 * 24))
  return { total, days, hours, minutes, seconds, expired: total === 0 }
}

/**
 * Format a TimeLeft value as a localized countdown string.
 *
 * Short form is used for the live ticker: "02:15:42".
 * Long form adds the label: "Ends in 2h 15m 42s" or "Ends in 1d 2h 15m".
 */
export const formatCountdown = (
  left: TimeLeftT,
  t: (key: string, options?: object) => string,
  short = false
): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (left.expired) return t('trialTimer.expired')

  if (short) {
    if (left.days > 0) {
      return `${pad(left.days)}:${pad(left.hours)}:${pad(left.minutes)}`
    }
    return `${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`
  }

  if (left.days > 0) {
    return t('trialTimer.endsInDays', {
      days: left.days,
      hours: left.hours,
      minutes: left.minutes
    })
  }
  return t('trialTimer.endsIn', {
    hours: left.hours,
    minutes: left.minutes,
    seconds: left.seconds
  })
}

/**
 * Return the stored trial-deadline timestamp, creating one 24 hours from now
 * if it does not exist. This gives every install a single limited-time window.
 */
export const getTrialDeadline = async (
  hours = DEFAULT_TRIAL_HOURS
): Promise<number> => {
  try {
    const stored = await AsyncStorage.getItem(TRIAL_DEADLINE_KEY)
    if (stored) {
      const deadline = Number(stored)
      if (!isNaN(deadline)) return deadline
    }
    const deadline = Date.now() + hours * 60 * 60 * 1000
    await AsyncStorage.setItem(TRIAL_DEADLINE_KEY, String(deadline))
    return deadline
  } catch (error) {
    captureException(error, 'getTrialDeadline')
    return Date.now() + hours * 60 * 60 * 1000
  }
}

/**
 * Reset the deadline. Useful for testing or for starting a fresh promotion.
 */
export const resetTrialDeadline = async (
  hours = DEFAULT_TRIAL_HOURS
): Promise<number> => {
  const deadline = Date.now() + hours * 60 * 60 * 1000
  try {
    await AsyncStorage.setItem(TRIAL_DEADLINE_KEY, String(deadline))
  } catch (error) {
    captureException(error, 'resetTrialDeadline')
  }
  return deadline
}
