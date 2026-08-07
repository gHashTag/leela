import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const STORAGE_KEY = '@todayIntention'

export async function loadTodayIntention(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY)
  } catch (error) {
    captureException(error, 'loadTodayIntention')
    return null
  }
}

export async function saveTodayIntention(intention: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, intention)
  } catch (error) {
    captureException(error, 'saveTodayIntention')
  }
}

export async function clearTodayIntention(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    captureException(error, 'clearTodayIntention')
  }
}
