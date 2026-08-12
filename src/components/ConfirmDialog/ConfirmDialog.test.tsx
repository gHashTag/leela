import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { ConfirmDialog } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    notificationWarning: 'notificationWarning'
  },
  trigger: jest.fn()
}))

describe('<ConfirmDialog />', () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const baseProps = {
    visible: true,
    title: 'Delete account?',
    message: 'This cannot be undone.',
    onConfirm,
    onCancel
  }

  beforeEach(() => {
    onConfirm.mockClear()
    onCancel.mockClear()
  })

  it('renders title, message and buttons', () => {
    const { getByText } = render(<ConfirmDialog {...baseProps} />)
    expect(getByText('Delete account?')).toBeTruthy()
    expect(getByText('This cannot be undone.')).toBeTruthy()
    expect(getByText('Confirm')).toBeTruthy()
    expect(getByText('Cancel')).toBeTruthy()
  })

  it('uses custom button titles', () => {
    const { getByText } = render(
      <ConfirmDialog
        {...baseProps}
        confirmTitle="Delete"
        cancelTitle="Keep"
      />
    )
    expect(getByText('Delete')).toBeTruthy()
    expect(getByText('Keep')).toBeTruthy()
  })

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <ConfirmDialog {...baseProps} visible={false} />
    )
    expect(queryByText('Delete account?')).toBeNull()
  })

  it('calls onConfirm when confirm pressed', () => {
    const { getByText } = render(<ConfirmDialog {...baseProps} />)
    fireEvent.press(getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel pressed', () => {
    const { getByText } = render(<ConfirmDialog {...baseProps} />)
    fireEvent.press(getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
