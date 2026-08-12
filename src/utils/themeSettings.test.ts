import AsyncStorage from '@react-native-async-storage/async-storage'

import { loadThemePreference, saveThemePreference } from './themeSettings'

const mockStorage: Record<string, string> = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value
    return Promise.resolve()
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null))
}))

describe('themeSettings', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  })

  it('defaults to system when no value is stored', async () => {
    const theme = await loadThemePreference()
    expect(theme).toBe('system')
  })

  it('saves and loads the high contrast theme', async () => {
    await saveThemePreference('highContrast')
    const theme = await loadThemePreference()
    expect(theme).toBe('highContrast')
  })

  it('falls back to system for invalid stored values', async () => {
    await AsyncStorage.setItem('@appTheme', 'invalid')
    const theme = await loadThemePreference()
    expect(theme).toBe('system')
  })
})
