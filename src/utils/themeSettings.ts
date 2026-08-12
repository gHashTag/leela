import AsyncStorage from '@react-native-async-storage/async-storage'

import { captureException } from '../constants'

const STORAGE_KEY = '@appTheme'

export type AppTheme = 'system' | 'light' | 'dark' | 'highContrast'

let currentTheme: AppTheme = 'system'
const listeners = new Set<(theme: AppTheme) => void>()

export function getAppTheme(): AppTheme {
  return currentTheme
}

export function setAppTheme(theme: AppTheme): void {
  currentTheme = theme
  listeners.forEach((listener) => listener(theme))
}

export function subscribeToTheme(listener: (theme: AppTheme) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function loadThemePreference(): Promise<AppTheme> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return 'system'
    const value = raw as AppTheme
    if (['system', 'light', 'dark', 'highContrast'].includes(value)) {
      setAppTheme(value)
      return value
    }
    return 'system'
  } catch (error) {
    captureException(error, 'loadThemePreference')
    return 'system'
  }
}

export async function saveThemePreference(theme: AppTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, theme)
    setAppTheme(theme)
  } catch (error) {
    captureException(error, 'saveThemePreference')
  }
}
