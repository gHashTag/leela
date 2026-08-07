import React from 'react'
import { render } from '@testing-library/react-native'

import { PlanAvatar } from './index'

describe('PlanAvatar', () => {
  it('renders with a plan number badge', () => {
    const { getByText } = render(
      <PlanAvatar plan={5} size="medium" avaUrl="https://example.com/ava.png" isAccept />
    )
    expect(getByText('05')).toBeTruthy()
  })

  it('renders a clock icon when the post is not accepted', () => {
    const { getByTestId } = render(
      <PlanAvatar
        plan={5}
        size="medium"
        avaUrl="https://example.com/ava.png"
        isAccept={false}
        testID="plan-avatar"
      />
    )
    expect(getByTestId('plan-avatar')).toBeTruthy()
  })

  it('renders with a local image source without a placeholder', () => {
    const { getByTestId } = render(
      <PlanAvatar
        plan={5}
        size="medium"
        avaUrl={1}
        isAccept
        testID="plan-avatar"
      />
    )
    expect(getByTestId('plan-avatar')).toBeTruthy()
  })
})
