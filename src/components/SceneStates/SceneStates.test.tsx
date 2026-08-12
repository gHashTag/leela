import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

import { SceneStates } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactMedium: 'impactMedium'
  },
  trigger: jest.fn()
}))

describe('<SceneStates />', () => {
  it('renders loading state', () => {
    const { getByText } = render(
      <SceneStates state={{ type: 'loading' }} />
    )
    expect(getByText('Loading…')).toBeTruthy()
  })

  it('renders error state with retry', () => {
    const onRetry = jest.fn()
    const { getByText } = render(
      <SceneStates state={{ type: 'error', onRetry }} />
    )
    expect(getByText('Error')).toBeTruthy()
    expect(getByText('Retry')).toBeTruthy()
  })

  it('renders empty state', () => {
    const { getByText } = render(
      <SceneStates
        state={{ type: 'empty', title: 'Nothing here', message: 'Create your first post' }}
      />
    )
    expect(getByText('Nothing here')).toBeTruthy()
    expect(getByText('Create your first post')).toBeTruthy()
  })

  it('renders children when ready', () => {
    const { getByText } = render(
      <SceneStates state={{ type: 'ready' }}>
        <Text>Content</Text>
      </SceneStates>
    )
    expect(getByText('Content')).toBeTruthy()
  })

  it('calls onRetry when retry pressed', () => {
    const onRetry = jest.fn()
    const { getByText } = render(
      <SceneStates state={{ type: 'error', onRetry }} />
    )
    fireEvent.press(getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders enriched empty state with icon, message and action', () => {
    const onAction = jest.fn()
    const { getByText, getByTestId } = render(
      <SceneStates
        state={{
          type: 'empty',
          title: 'No answers yet',
          message: 'Complete a report to get one.',
          icon: '✨',
          action: { title: 'Start game', onPress: onAction }
        }}
      />
    )
    expect(getByText('No answers yet')).toBeTruthy()
    expect(getByText('Complete a report to get one.')).toBeTruthy()
    expect(getByText('✨')).toBeTruthy()
    fireEvent.press(getByTestId('scene-states-empty-action'))
    expect(onAction).toHaveBeenCalled()
  })
})
