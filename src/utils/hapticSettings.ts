import AsyncStorage from '@react-native-async-storage/async-storage'

import { captureException } from '../constants'

const HAPTIC_KEY = '@hapticEnabled'

export async function loadHapticEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(HAPTIC_KEY)
    return raw === null ? true : raw === 'true'
  } catch (error) {
    captureException(error, 'loadHapticEnabled')
    return true
  }
}

export async function saveHapticEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HAPTIC_KEY, String(enabled))
  } catch (error) {
    captureException(error, 'saveHapticEnabled')
  }
}
