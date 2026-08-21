import React from 'react'
import { render } from '@testing-library/react-native'

import { WinCelebration } from './'
import { DiceStore, OnlinePlayer } from '../../store'

jest.mock('../../utils/useReducedMotion', () => ({
  useReducedMotion: () => false
}))

const mockDiceStore = DiceStore as typeof DiceStore
const mockOnlinePlayer = OnlinePlayer as typeof OnlinePlayer

describe('<WinCelebration />', () => {
  beforeEach(() => {
    mockDiceStore.online = false
    mockDiceStore.finishArr = [true, true, true]
    mockOnlinePlayer.store.finish = false
  })

  it('renders nothing while the game is in progress', () => {
    mockDiceStore.finishArr = [true, true, true]

    const { toJSON } = render(<WinCelebration />)
    expect(toJSON()).toBeNull()
  })

  it('renders celebration when offline players all finish', () => {
    mockDiceStore.finishArr = [false, false, false]

    const { getByLabelText } = render(<WinCelebration />)
    expect(
      getByLabelText('Game finished. Cosmic Consciousness reached.')
    ).toBeTruthy()
  })

  it('renders celebration when online game finishes', () => {
    mockDiceStore.online = true
    mockOnlinePlayer.store.finish = true

    const { getByLabelText } = render(<WinCelebration />)
    expect(
      getByLabelText('Game finished. Cosmic Consciousness reached.')
    ).toBeTruthy()
  })
})
