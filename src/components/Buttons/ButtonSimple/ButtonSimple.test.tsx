import React from 'react'
import { render } from '@testing-library/react-native'

import { ButtonSimple } from './index'

describe('<ButtonSimple />', () => {
  it('uses the title as the default accessibility label', () => {
    const { getByTestId } = render(
      <ButtonSimple title="Continue" testID="simple-button" />
    )
    expect(getByTestId('simple-button').props.accessibilityLabel).toBe(
      'Continue'
    )
    expect(getByTestId('simple-button').props.accessibilityRole).toBe('button')
  })
})
