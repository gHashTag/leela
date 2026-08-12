import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { ButtonsSelector } from './index'

describe('<ButtonsSelector />', () => {
  it('starts with one player selected and confirms the choice', () => {
    const mockOnPress = jest.fn()
    const { getByTestId } = render(<ButtonsSelector onPress={mockOnPress} />)

    fireEvent.press(getByTestId('player-count-3'))
    fireEvent.press(getByTestId('select-players-start-button'))

    expect(mockOnPress).toHaveBeenCalledWith(2)
  })

  it('marks the selected player count as selected', () => {
    const { getByTestId } = render(<ButtonsSelector onPress={jest.fn()} />)

    const selected = getByTestId('player-count-1')
    expect(selected.props.accessibilityState.selected).toBe(true)
    expect(getByTestId('player-count-4').props.accessibilityState.selected).toBe(false)
  })
})
