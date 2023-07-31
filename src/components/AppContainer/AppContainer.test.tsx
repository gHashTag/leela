import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

import { AppContainer } from './'
import { Text } from 'react-native'

describe('<AppContainer />', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <AppContainer title="Test Title">
        <Text>Child Component</Text>
      </AppContainer>
    )

    expect(getByText('Test Title')).toBeTruthy()
    expect(getByText('Child Component')).toBeTruthy()
  })

  it('calls onPress when header is clicked', () => {
    const onPressMock = jest.fn()

    const { getByTestId } = render(
      <AppContainer title="Test Title" onPress={onPressMock}>
        <Text>Child Component</Text>
      </AppContainer>
    )

    fireEvent.press(getByTestId('header'))
    expect(onPressMock).toHaveBeenCalled()
  })

  it('does not render header if header prop is false', () => {
    const { queryByText } = render(
      <AppContainer title="Test Title" header={false}>
        <Text>Child Component</Text>
      </AppContainer>
    )

    expect(queryByText('Test Title')).toBeNull()
  })
})
