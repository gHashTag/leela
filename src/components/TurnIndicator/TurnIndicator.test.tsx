import React from 'react'
import { render } from '@testing-library/react-native'

import { TurnIndicator } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight'
  },
  trigger: jest.fn()
}))

jest.mock('../../store', () => ({
  DiceStore: {
    online: false,
    players: 2
  },
  OnlinePlayer: {
    store: {
      isReported: true,
      canGo: true,
      timeText: '0:00'
    }
  }
}))

jest.mock('../../utils/useReducedMotion', () => ({
  useReducedMotion: () => false
}))

describe('<TurnIndicator />', () => {
  it('shows the current offline player', () => {
    const { getByTestId } = render(<TurnIndicator />)
    expect(getByTestId('turn-indicator')).toBeTruthy()
  })
})
