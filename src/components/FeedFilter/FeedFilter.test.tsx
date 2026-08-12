import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { FeedFilter } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight'
  },
  trigger: jest.fn()
}))

describe('<FeedFilter />', () => {
  it('renders all filter chips', () => {
    const { getByLabelText } = render(
      <FeedFilter selected="newest" onSelect={jest.fn()} />
    )
    expect(getByLabelText('Newest')).toBeTruthy()
    expect(getByLabelText('Most discussed')).toBeTruthy()
    expect(getByLabelText('My reports')).toBeTruthy()
  })

  it('calls onSelect when a chip is pressed', () => {
    const onSelect = jest.fn()
    const { getByLabelText } = render(
      <FeedFilter selected="newest" onSelect={onSelect} />
    )
    fireEvent.press(getByLabelText('My reports'))
    expect(onSelect).toHaveBeenCalledWith('myPosts')
  })
})
