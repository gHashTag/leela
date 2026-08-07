import AsyncStorage from '@react-native-async-storage/async-storage'

import { captureException } from '../constants'

const STORAGE_KEY = '@soundEnabled'

export async function loadSoundEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw === null ? true : raw === 'true'
  } catch (error) {
    captureException(error, 'loadSoundEnabled')
    return true
  }
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled))
  } catch (error) {
    captureException(error, 'saveSoundEnabled')
  }
}
