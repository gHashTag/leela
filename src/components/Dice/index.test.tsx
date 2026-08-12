import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { Dice } from './index'

const mockTrigger = jest.fn()

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    notificationWarning: 'notificationWarning'
  },
  trigger: (...args: any[]) => mockTrigger(...args)
}))

jest.mock('../../utils/soundEffects', () => ({
  playDiceSound: jest.fn()
}))

jest.mock('../../store', () => ({
  DiceStore: { online: false, count: 3, finishArr: [false] },
  OfflinePlayers: { updateStep: jest.fn() },
  OnlinePlayer: {
    store: { canGo: true, isReported: false },
    updateStep: jest.fn()
  },
  actionsDice: { random: jest.fn() }
}))

jest.mock('../../utils/useReducedMotion', () => ({
  useReducedMotion: () => false
}))

describe('<Dice />', () => {
  beforeEach(() => {
    mockTrigger.mockClear()
  })

  it('renders roll dice button', () => {
    const { getByAccessibilityHint } = render(<Dice />)
    expect(
      getByAccessibilityHint('Double tap to roll the dice and move your piece')
    ).toBeTruthy()
  })

  it('triggers haptic feedback on roll', () => {
    jest.useFakeTimers()
    const { getByAccessibilityHint } = render(<Dice />)
    fireEvent.press(
      getByAccessibilityHint('Double tap to roll the dice and move your piece')
    )
    expect(mockTrigger).toHaveBeenCalledWith(
      'impactMedium',
      expect.objectContaining({ enableVibrateFallback: true })
    )
    jest.useRealTimers()
  })

  it('announces the current dice value in accessibility label', () => {
    const { getByTestId } = render(<Dice />)
    const dice = getByTestId('dice-roll')
    expect(dice.props.accessibilityLabel).toContain('3')
  })
})
