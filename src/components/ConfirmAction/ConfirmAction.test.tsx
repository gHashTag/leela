import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Button, Text, View } from 'react-native'

import { useConfirmActions } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    notificationWarning: 'notificationWarning'
  },
  trigger: jest.fn()
}))

const TestComponent = () => {
  const { guardActions, ConfirmDialogComponent } = useConfirmActions(
    (key: string) => {
      const map: Record<string, string> = {
        'confirm.deletePostTitle': 'Delete post?',
        'confirm.deletePostMessage': 'This cannot be undone.',
        'actions.delete': 'Delete',
        'actions.cancel': 'Cancel'
      }
      return map[key] || key
    }
  )

  const actions = guardActions([
    {
      key: 'DEL_POST',
      title: 'Delete post',
      onPress: jest.fn(),
      icon: 'trash-outline'
    },
    { key: 'EDIT', title: 'Edit', onPress: jest.fn(), icon: 'create-outline' }
  ])

  return (
    <View>
      {actions.map((a) => (
        <Button key={a.key} title={a.title} onPress={a.onPress} />
      ))}
      <ConfirmDialogComponent />
    </View>
  )
}

describe('useConfirmActions', () => {
  it('wraps destructive actions in confirmation', () => {
    const { getByText } = render(<TestComponent />)
    fireEvent.press(getByText('Delete post'))
    expect(getByText('Delete post?')).toBeTruthy()
    expect(getByText('This cannot be undone.')).toBeTruthy()
  })

  it('does not wrap non-destructive actions', () => {
    const mockPress = jest.fn()
    const TestNonDestructive = () => {
      const { guardActions } = useConfirmActions((key: string) => key)
      const actions = guardActions([
        { key: 'EDIT', title: 'Edit', onPress: mockPress, icon: 'create-outline' }
      ])
      return (
        <View>
          {actions.map((a) => (
            <Button key={a.key} title={a.title} onPress={a.onPress} />
          ))}
        </View>
      )
    }
    const { getByText, queryByText } = render(<TestNonDestructive />)
    fireEvent.press(getByText('Edit'))
    expect(mockPress).toHaveBeenCalled()
    expect(queryByText('Delete post?')).toBeNull()
  })
})
