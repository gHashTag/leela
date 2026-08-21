import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { SettingsRow } from './index'

const mockTrigger = jest.fn()
jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight'
  },
  trigger: (...args: any[]) => mockTrigger(...args)
}))

describe('<SettingsRow />', () => {
  beforeEach(() => {
    mockTrigger.mockClear()
  })

  it('renders a toggle row and fires on press', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(
      <SettingsRow
        title="Haptic feedback"
        toggle
        value={false}
        onPress={onPress}
        testID="haptic-row"
      />
    )
    fireEvent(getByTestId('haptic-row'), 'press')
    expect(onPress).toHaveBeenCalled()
    expect(mockTrigger).toHaveBeenCalledWith('impactLight', expect.any(Object))
  })

  it('renders a navigation row with a value label', () => {
    const { getByText } = render(
      <SettingsRow title="Subscription" valueLabel="Free" />
    )
    expect(getByText('Subscription')).toBeTruthy()
    expect(getByText('Free')).toBeTruthy()
  })
})
