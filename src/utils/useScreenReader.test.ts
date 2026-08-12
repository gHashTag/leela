const mockGetScreenReader = jest.fn()
const mockRemove = jest.fn()
const mockAddEventListener = jest.fn()

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isScreenReaderEnabled: jest.fn(() => mockGetScreenReader()),
    addEventListener: jest.fn((event: string, handler: (value: boolean) => void) => {
      mockAddEventListener(event, handler)
      return { remove: mockRemove }
    })
  },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: any) => s }
}))

import { renderHook, waitFor } from '@testing-library/react-native'
import { useScreenReader } from './useScreenReader'

describe('useScreenReader', () => {
  beforeEach(() => {
    mockGetScreenReader.mockReset()
    mockAddEventListener.mockReset()
    mockRemove.mockReset()
  })

  it('reads the initial screen reader setting', async () => {
    mockGetScreenReader.mockResolvedValue(true)
    const { result } = renderHook(() => useScreenReader())
    await waitFor(() => expect(result.current).toBe(true))
  })
})
