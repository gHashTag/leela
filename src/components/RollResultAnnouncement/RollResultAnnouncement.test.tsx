import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import { RollResultAnnouncement } from './index'

const mockTrigger = jest.fn()

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    notificationWarning: 'notificationWarning'
  },
  trigger: (...args: any[]) => mockTrigger(...args)
}))

jest.mock('../../store', () => ({
  DiceStore: {
    online: false,
    count: 3,
    players: 1
  },
  OfflinePlayers: {
    store: {
      histories: [
        [{ createDate: 1700000000000, plan: 6, count: 3, status: 'cube' }]
      ]
    }
  },
  OnlinePlayer: {
    store: { history: [] }
  }
}))

jest.mock('../../utils/useReducedMotion', () => ({
  useReducedMotion: () => false
}))

describe('<RollResultAnnouncement />', () => {
  it('announces the last roll with from/to cells', async () => {
    const { getByTestId } = render(<RollResultAnnouncement />)
    await waitFor(() => {
      expect(getByTestId('roll-result-announcement')).toBeTruthy()
    })
  })
})
