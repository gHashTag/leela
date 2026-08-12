import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { InlineCommentInput } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactMedium: 'impactMedium'
  },
  trigger: jest.fn()
}))

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({ currentUser: { uid: 'user-1', email: 'test@test.com' } })
}))

describe('<InlineCommentInput />', () => {
  it('renders input and send button', () => {
    const { getByTestId } = render(
      <InlineCommentInput postId="post-1" postOwner="owner-1" />
    )
    expect(getByTestId('inline-comment-input')).toBeTruthy()
    expect(getByTestId('inline-comment-send')).toBeTruthy()
  })

  it('updates input value when typing', () => {
    const { getByTestId } = render(
      <InlineCommentInput postId="post-1" postOwner="owner-1" />
    )
    const input = getByTestId('inline-comment-input')
    fireEvent.changeText(input, 'Hello Leela')
    expect(input.props.value).toBe('Hello Leela')
  })
})
