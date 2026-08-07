import AsyncStorage from '@react-native-async-storage/async-storage'

import { captureException } from '../constants'

const START_KEY = '@crashFreeSessionStart'
const STATUS_KEY = '@crashFreeSessionStatus'

export type CrashFreeSessionStatus = 'ok' | 'crashed' | 'unknown'

export interface SessionHealth {
  startedAt: number
  status: CrashFreeSessionStatus
}

export async function loadSessionHealth(): Promise<SessionHealth> {
  try {
    const raw = await AsyncStorage.multiGet([START_KEY, STATUS_KEY])
    const startedAt = Number(raw[0][1])
    const status = (raw[1][1] || 'unknown') as CrashFreeSessionStatus
    return {
      startedAt: isNaN(startedAt) ? Date.now() : startedAt,
      status
    }
  } catch (error) {
    captureException(error, 'loadSessionHealth')
    return { startedAt: Date.now(), status: 'unknown' }
  }
}

export async function markSessionStarted(): Promise<void> {
  try {
    await AsyncStorage.setItem(START_KEY, String(Date.now()))
    await AsyncStorage.setItem(STATUS_KEY, 'ok')
  } catch (error) {
    captureException(error, 'markSessionStarted')
  }
}

export async function markSessionCrashed(): Promise<void> {
  try {
    await AsyncStorage.setItem(STATUS_KEY, 'crashed')
  } catch (error) {
    captureException(error, 'markSessionCrashed')
  }
}

export async function clearSessionHealth(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([START_KEY, STATUS_KEY])
  } catch (error) {
    captureException(error, 'clearSessionHealth')
  }
}
