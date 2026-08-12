import { setHapticEnabled, triggerHaptic } from './haptics'

const mockTrigger = jest.fn()

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError'
  },
  trigger: (...args: any[]) => {
    mockTrigger(...args)
  }
}))

describe('triggerHaptic', () => {
  beforeEach(() => {
    mockTrigger.mockClear()
    setHapticEnabled(true)
  })

  it('triggers impactLight by default', () => {
    triggerHaptic()
    expect(mockTrigger).toHaveBeenCalledTimes(1)
    expect(mockTrigger).toHaveBeenCalledWith(
      'impactLight',
      expect.objectContaining({ enableVibrateFallback: true })
    )
  })

  it('triggers the requested type', () => {
    triggerHaptic('notificationSuccess')
    expect(mockTrigger).toHaveBeenCalledWith(
      'notificationSuccess',
      expect.objectContaining({ enableVibrateFallback: true })
    )
  })

  it('does not throw when haptics fail', () => {
    mockTrigger.mockImplementation(() => {
      throw new Error('haptics unavailable')
    })
    expect(() => triggerHaptic()).not.toThrow()
  })

  it('respects the global haptic enabled flag', () => {
    setHapticEnabled(false)
    triggerHaptic()
    expect(mockTrigger).not.toHaveBeenCalled()
  })
})
