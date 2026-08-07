import React from 'react'
import { render } from '@testing-library/react-native'

import { WeeklyRecap } from './index'

jest.mock('../StreakJournal', () => ({
  loadEntries: jest.fn().mockResolvedValue([]),
  computeStreak: () => 0
}))

jest.mock('../../store', () => ({
  DiceStore: { online: false, players: 1 },
  OfflinePlayers: {
    store: {
      histories: [[]]
    }
  },
  OnlinePlayer: {
    store: {
      history: []
    }
  },
  PostStore: {
    store: {
      ownPosts: []
    }
  }
}))

describe('<WeeklyRecap />', () => {
  it('renders the recap title and three stat labels', () => {
    const { getByText } = render(<WeeklyRecap />)

    expect(getByText(/This week/)).toBeTruthy()
    expect(getByText('rolls')).toBeTruthy()
    expect(getByText('reports')).toBeTruthy()
    expect(getByText('streak')).toBeTruthy()
  })
})
