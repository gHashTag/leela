import AsyncStorage from '@react-native-async-storage/async-storage'

interface StorageOptions {
  ttl: number
}

interface StorageAdapter extends StorageOptions {
  getItem(key: string): Promise<any>
  setItem(key: string, data: any): Promise<void>
  removeItem(key: string): Promise<void>
}

const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000 // milliseconds in a year

export const storageAdapter: StorageAdapter = {
  getItem: async (key) => {
    const item = JSON.parse((await AsyncStorage.getItem(key)) || '{}')
    if (item && Date.now() - item.timestamp < ONE_YEAR_IN_MS) {
      return item.data
    }
    await AsyncStorage.removeItem(key)
    return null
  },
  setItem: async (key, data) => {
    const item = {
      timestamp: Date.now(),
      data
    }
    AsyncStorage.setItem(key, JSON.stringify(item))
  },
  removeItem: async (key) => AsyncStorage.removeItem(key),
  ttl: ONE_YEAR_IN_MS // время жизни данных в миллисекундах (1 год)
}
