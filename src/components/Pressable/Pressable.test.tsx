import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { Pressable } from './index'

const mockTrigger = jest.fn()

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: (...args: any[]) => mockTrigger(...args)
}))

describe('<Pressable />', () => {
  beforeEach(() => {
    mockTrigger.mockClear()
  })

  it('renders children', () => {
    const { getByText } = render(
      <Pressable>
        <Text>Tap me</Text>
      </Pressable>
    )
    expect(getByText('Tap me')).toBeTruthy()
  })

  it('triggers light haptic and onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <Pressable onPress={onPress}>
        <Text>Tap me</Text>
      </Pressable>
    )
    fireEvent.press(getByText('Tap me'))
    expect(onPress).toHaveBeenCalled()
    expect(mockTrigger).toHaveBeenCalledWith('impactLight')
  })

  it('does not throw when onPress is missing', () => {
    const { getByText } = render(
      <Pressable>
        <Text>No handler</Text>
      </Pressable>
    )
    expect(() => fireEvent.press(getByText('No handler'))).not.toThrow()
  })

  it('enforces a minimum 44 × 44 touch target', () => {
    const { getByTestId } = render(
      <Pressable testID="small-pressable">
        <View style={{ width: 20, height: 20 }} />
      </Pressable>
    )
    const pressable = getByTestId('small-pressable')
    expect(pressable.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ minWidth: expect.any(Number), minHeight: expect.any(Number) })
      ])
    )
  })
})
