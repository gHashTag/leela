// Import libraries
import React from 'react'
import { render } from '@testing-library/react-native'

// Import the component to be tested
import { Space } from './'

describe('Space', () => {
  it('renders correctly with default props', () => {
    const { getByTestId } = render(<Space />)
    const spaceComponent = getByTestId('space-component')

    expect(spaceComponent.props.style).toEqual({ height: 0, width: 0 })
  })

  it('renders correctly with given height and width', () => {
    const { getByTestId } = render(<Space height={10} width={20} />)
    const spaceComponent = getByTestId('space-component')

    expect(spaceComponent.props.style).toEqual({ height: 10, width: 20 })
  })
})
