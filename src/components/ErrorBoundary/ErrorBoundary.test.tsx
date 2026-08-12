import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { ErrorBoundary } from './index'

const mockCaptureException = jest.fn()

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args)
}))

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium'
  },
  trigger: jest.fn()
}))

let throwCount = 0

beforeEach(() => {
  throwCount = 0
})

const ThrowOnceThenOk = () => {
  if (throwCount < 1) {
    throwCount++
    throw new Error('boom')
  }
  return <Text>OK</Text>
}

describe('<ErrorBoundary />', () => {
  beforeEach(() => {
    mockCaptureException.mockClear()
  })

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <View>
          <Text>Child content</Text>
        </View>
      </ErrorBoundary>
    )
    expect(getByText('Child content')).toBeTruthy()
  })

  it('renders fallback UI when a child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowOnceThenOk />
      </ErrorBoundary>
    )
    expect(getByText('Something went wrong')).toBeTruthy()
    expect(getByText('Try again')).toBeTruthy()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
  })

  it('can recover via retry button', async () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowOnceThenOk />
      </ErrorBoundary>
    )
    expect(getByText('Try again')).toBeTruthy()
    fireEvent.press(getByText('Try again'))
    await waitFor(() => {
      expect(queryByText('OK')).toBeTruthy()
    })
  })
})
