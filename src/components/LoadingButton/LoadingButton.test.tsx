import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { LoadingButton } from './index'

const mockTrigger = jest.fn()

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium'
  },
  trigger: (...args: any[]) => mockTrigger(...args)
}))

describe('<LoadingButton />', () => {
  beforeEach(() => {
    mockTrigger.mockClear()
  })

  it('renders title when not loading', () => {
    const { getByText } = render(<LoadingButton title="Submit" />)
    expect(getByText('Submit')).toBeTruthy()
  })

  it('shows activity indicator when loading', () => {
    const { queryByText } = render(<LoadingButton title="Submit" loading />)
    expect(queryByText('Submit')).toBeNull()
  })

  it('does not call onPress when loading', () => {
    const onPress = jest.fn()
    const { getByRole } = render(
      <LoadingButton title="Submit" loading onPress={onPress} />
    )
    fireEvent.press(getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('calls onPress and triggers haptic when not loading', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <LoadingButton title="Submit" onPress={onPress} />
    )
    fireEvent.press(getByText('Submit'))
    expect(onPress).toHaveBeenCalled()
    expect(mockTrigger).toHaveBeenCalledWith('impactLight', expect.anything())
  })

  it('uses medium haptic when configured', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <LoadingButton title="Submit" onPress={onPress} haptic="impactMedium" />
    )
    fireEvent.press(getByText('Submit'))
    expect(mockTrigger).toHaveBeenCalledWith('impactMedium', expect.anything())
  })
})
