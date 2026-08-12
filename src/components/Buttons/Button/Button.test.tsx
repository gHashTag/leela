import React from 'react'
import { render } from '@testing-library/react-native'

import { Button } from './index'

describe('<Button />', () => {
  it('uses the title as the default accessibility label', () => {
    const { getByTestId } = render(
      <Button title="Start game" testID="start-button" />
    )
    expect(getByTestId('start-button').props.accessibilityLabel).toBe('Start game')
    expect(getByTestId('start-button').props.accessibilityRole).toBe('button')
  })

  it('forwards a custom accessibility label and hint', () => {
    const { getByTestId } = render(
      <Button
        title="Start"
        testID="start-button"
        accessibilityLabel="Start a new Leela game"
        accessibilityHint="Begins an offline game for one player"
      />
    )
    expect(getByTestId('start-button').props.accessibilityLabel).toBe(
      'Start a new Leela game'
    )
    expect(getByTestId('start-button').props.accessibilityHint).toBe(
      'Begins an offline game for one player'
    )
  })
})
