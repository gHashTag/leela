import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { ResumeLastGame } from './'
import { DiceStore, OnlinePlayer } from '../../store'

const mockResume = jest.fn()

describe('<ResumeLastGame />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    DiceStore.online = false
    DiceStore.startGame = false
    DiceStore.finishArr = []
    DiceStore.multi = 1
    DiceStore.players = 1
    OnlinePlayer.store.start = false
    OnlinePlayer.store.finish = false
  })

  it('is hidden when there is no saved game', () => {
    const { queryByTestId } = render(
      <ResumeLastGame onResume={mockResume} />
    )

    expect(queryByTestId('resume-last-game')).toBeNull()
  })

  it('shows the offline resume card when an offline game is in progress', () => {
    DiceStore.startGame = true
    DiceStore.finishArr = [true, false]
    DiceStore.multi = 2

    const { getByTestId, getByText } = render(
      <ResumeLastGame onResume={mockResume} />
    )

    expect(getByTestId('resume-last-game')).toBeTruthy()
    expect(getByText(/Offline match in progress/)).toBeTruthy()
    expect(getByText(/2 players/)).toBeTruthy()
  })

  it('shows the online resume card when an online game is in progress', () => {
    DiceStore.online = true
    OnlinePlayer.store.start = true
    OnlinePlayer.store.finish = false

    const { getByTestId, getByText } = render(
      <ResumeLastGame onResume={mockResume} />
    )

    expect(getByTestId('resume-last-game')).toBeTruthy()
    expect(getByText(/Online match in progress/)).toBeTruthy()
  })

  it('calls onResume when pressed', () => {
    DiceStore.startGame = true
    DiceStore.finishArr = [true]

    const { getByTestId } = render(
      <ResumeLastGame onResume={mockResume} />
    )

    fireEvent.press(getByTestId('resume-last-game'))
    expect(mockResume).toHaveBeenCalledTimes(1)
  })
})
