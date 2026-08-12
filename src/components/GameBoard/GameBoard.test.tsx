import React from 'react'
import { render } from '@testing-library/react-native'

import { GameBoard } from './index'

jest.mock('./images', () => ({
  ICONS: [
    { path: { uri: 'light' }, title: 'light' },
    { path: { uri: 'dark' }, title: 'dark' }
  ]
}))

jest.mock('../Gem', () => ({
  Gem: () => null
}))

jest.mock('../../store', () => ({
  DiceStore: {
    online: false,
    players: 1
  },
  OfflinePlayers: {
    store: {
      plans: [1],
      histories: [[]]
    }
  },
  OnlinePlayer: {
    store: {
      plan: 1,
      history: []
    }
  }
}))

const mockUseAppTheme = jest.fn().mockReturnValue('system')
jest.mock('../../utils/useAppTheme', () => ({
  useAppTheme: () => mockUseAppTheme()
}))

describe('<GameBoard />', () => {
  beforeEach(() => {
    mockUseAppTheme.mockReturnValue('system')
  })

  it('renders without crashing and exposes the board image role', () => {
    const { getByRole } = render(<GameBoard />)
    expect(getByRole('image')).toBeTruthy()
  })

  it('renders high-contrast background when theme is highContrast', () => {
    mockUseAppTheme.mockReturnValue('highContrast')
    const { UNSAFE_queryAllByType } = render(<GameBoard />)
    const images = UNSAFE_queryAllByType('Image' as any)
    expect(images.length).toBe(0)
  })
})
