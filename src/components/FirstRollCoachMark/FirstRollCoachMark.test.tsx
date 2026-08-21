import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import React from 'react'

import { FirstRollCoachMark } from './index'

describe('<FirstRollCoachMark />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when the coach mark has not been shown before', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    const { getByText, getByTestId } = render(
      <FirstRollCoachMark online={false} />
    )
    await waitFor(() => {
      expect(getByText('Your turn')).toBeTruthy()
      expect(
        getByText('Tap the dice to roll. A six places your piece on the board.')
      ).toBeTruthy()
      expect(getByTestId('first-roll-coach-got-it')).toBeTruthy()
    })
  })

  it('does not render when the coach mark was already dismissed', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true')
    const { queryByText } = render(<FirstRollCoachMark online={false} />)
    await waitFor(() => {
      expect(queryByText('Your turn')).toBeNull()
    })
  })

  it('dismisses and persists the flag when Got it is pressed', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    const { getByTestId, queryByText } = render(
      <FirstRollCoachMark online={false} />
    )
    await waitFor(() =>
      expect(getByTestId('first-roll-coach-got-it')).toBeTruthy()
    )
    fireEvent.press(getByTestId('first-roll-coach-got-it'))
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@leela:firstRollCoachShown',
        'true'
      )
      expect(queryByText('Your turn')).toBeNull()
    })
  })
})
