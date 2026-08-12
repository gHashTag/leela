import { renderHook, waitFor } from '@testing-library/react-native'

import { setAppTheme } from './themeSettings'
import { useAppTheme } from './useAppTheme'

const mockStorage: Record<string, string> = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value
    return Promise.resolve()
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null))
}))

describe('useAppTheme', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    setAppTheme('system')
  })

  it('returns the stored theme preference', async () => {
    mockStorage['@appTheme'] = 'dark'
    const { result } = renderHook(() => useAppTheme())
    await waitFor(() => {
      expect(result.current).toBe('dark')
    })
  })

  it('reacts to theme changes via subscription', async () => {
    const { result } = renderHook(() => useAppTheme())
    await waitFor(() => expect(result.current).toBe('system'))

    setAppTheme('highContrast')

    await waitFor(() => {
      expect(result.current).toBe('highContrast')
    })
  })
})
