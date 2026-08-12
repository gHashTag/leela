const mockAnnounce = jest.fn()

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    announceForAccessibility: (...args: any[]) => mockAnnounce(...args)
  },
  Platform: {
    OS: 'ios'
  }
}))

jest.mock('../constants', () => ({
  captureException: jest.fn()
}))

import { announceForAccessibility } from './accessibilityAnnouncements'

describe('accessibilityAnnouncements', () => {
  beforeEach(() => {
    mockAnnounce.mockClear()
  })

  it('announces a non-empty message', () => {
    announceForAccessibility('Player 1 rolled a 4')
    expect(mockAnnounce).toHaveBeenCalledWith('Player 1 rolled a 4')
  })

  it('ignores empty messages', () => {
    announceForAccessibility('')
    expect(mockAnnounce).not.toHaveBeenCalled()
  })
})
