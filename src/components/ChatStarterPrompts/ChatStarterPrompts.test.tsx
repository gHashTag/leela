import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { ChatStarterPrompts } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight'
  },
  trigger: jest.fn()
}))

describe('<ChatStarterPrompts />', () => {
  it('renders prompt chips', () => {
    const { getByTestId, getByText } = render(
      <ChatStarterPrompts onSelect={jest.fn()} />
    )
    expect(getByTestId('chat-starter-prompts')).toBeTruthy()
    expect(
      getByText('Ask Leela about the board, your plane, or a daily step')
    ).toBeTruthy()
    expect(getByTestId('chat-starter-prompt-0')).toBeTruthy()
  })

  it('calls onSelect with the prompt text when a chip is pressed', () => {
    const onSelect = jest.fn()
    const { getByTestId } = render(<ChatStarterPrompts onSelect={onSelect} />)
    fireEvent.press(getByTestId('chat-starter-prompt-0'))
    expect(onSelect).toHaveBeenCalledWith('Explain my current plane')
  })

  it('returns null when not visible', () => {
    const { queryByTestId } = render(
      <ChatStarterPrompts onSelect={jest.fn()} visible={false} />
    )
    expect(queryByTestId('chat-starter-prompts')).toBeNull()
  })
})
