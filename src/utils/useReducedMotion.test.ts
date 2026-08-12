const mockGetReduceMotion = jest.fn()
const mockRemove = jest.fn()
const mockAddEventListener = jest.fn()

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => mockGetReduceMotion()),
    addEventListener: jest.fn((event: string, handler: (value: boolean) => void) => {
      mockAddEventListener(event, handler)
      return { remove: mockRemove }
    })
  },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: any) => s }
}))

import { renderHook, waitFor } from '@testing-library/react-native'
import { useReducedMotion } from './useReducedMotion'

describe('useReducedMotion', () => {
  beforeEach(() => {
    mockGetReduceMotion.mockReset()
    mockAddEventListener.mockReset()
    mockRemove.mockReset()
  })

  it('reads the initial Reduce Motion setting', async () => {
    mockGetReduceMotion.mockResolvedValue(true)
    const { result } = renderHook(() => useReducedMotion())
    await waitFor(() => expect(result.current).toBe(true))
  })
})
