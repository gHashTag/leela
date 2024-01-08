import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

import { Avatar, PressableAvatar } from './' // replace with your actual path

describe('Avatar', () => {
  it('should render loading state correctly', () => {
    const { getByTestId } = render(<Avatar loading={true} />)
    expect(getByTestId('avatar')).toBeTruthy()
  })

  it('should render image from uri correctly', () => {
    const { getByTestId } = render(
      <Avatar loading={false} uri="https://example.com/image.png" />
    )
    expect(getByTestId('avatar')).toBeTruthy()
  })
})

describe('PressableAvatar', () => {
  it('should call onPress when pressed', () => {
    const mockOnPress = jest.fn()
    const { getByTestId } = render(
      <PressableAvatar onPress={mockOnPress} loading={false} />
    )

    fireEvent.press(getByTestId('avatar'))
    expect(mockOnPress).toHaveBeenCalled()
  })
})
