import AsyncStorage from '@react-native-async-storage/async-storage'

import { loadHapticEnabled, saveHapticEnabled } from './hapticSettings'

const mockStorage: Record<string, string> = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value
    return Promise.resolve()
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null))
}))

describe('hapticSettings', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  })

  it('defaults to enabled when no value is stored', async () => {
    const enabled = await loadHapticEnabled()
    expect(enabled).toBe(true)
  })

  it('saves and loads the disabled state', async () => {
    await saveHapticEnabled(false)
    const enabled = await loadHapticEnabled()
    expect(enabled).toBe(false)
  })

  it('saves and loads the enabled state', async () => {
    await saveHapticEnabled(true)
    const enabled = await loadHapticEnabled()
    expect(enabled).toBe(true)
  })
})
