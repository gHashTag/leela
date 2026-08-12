import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { ProfileCompletionCard } from './index'

jest.mock('react-native-haptic-feedback', () => ({
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium'
  },
  trigger: jest.fn()
}))

jest.mock('../../store', () => ({
  OnlinePlayer: {
    store: {
      avatar: '',
      profile: {
        firstName: '',
        lastName: '',
        intention: ''
      },
      history: []
    }
  }
}))

describe('<ProfileCompletionCard />', () => {
  it('renders when profile is incomplete', () => {
    const { getByTestId, getByText } = render(
      <ProfileCompletionCard onCompleteStep={jest.fn()} />
    )
    expect(getByTestId('profile-completion-card')).toBeTruthy()
    expect(getByText('Complete your profile')).toBeTruthy()
  })

  it('calls onCompleteStep with the first missing step', () => {
    const onCompleteStep = jest.fn()
    const { getByTestId } = render(
      <ProfileCompletionCard onCompleteStep={onCompleteStep} />
    )
    fireEvent.press(getByTestId('profile-completion-action'))
    expect(onCompleteStep).toHaveBeenCalledWith('avatar')
  })

  it('can be dismissed', () => {
    const { getByTestId, queryByTestId } = render(
      <ProfileCompletionCard onCompleteStep={jest.fn()} />
    )
    fireEvent.press(getByTestId('profile-completion-dismiss'))
    expect(queryByTestId('profile-completion-card')).toBeNull()
  })
})
