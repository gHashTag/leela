import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import React from 'react'

import { OnboardingScreen } from './index'

const mockReplace = jest.fn()
const mockNavigation = { replace: mockReplace } as any

describe('<OnboardingScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.setItem('mock', 'reset')
  })

  it('renders the first step counter', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    expect(getByTestId('onboarding-step-counter').children[0]).toBe('Step 1 of 9')
  })

  it('advances the step counter when Next is pressed', () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    fireEvent.press(getByTestId('onboarding-next-button'))
    expect(getByTestId('onboarding-step-counter').children[0]).toBe('Step 2 of 9')
  })

  it('navigates to Hello when Skip is pressed', async () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    fireEvent.press(getByTestId('onboarding-skip-button'))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HELLO')
    })
  })

  it('completes onboarding on the last step', async () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    for (let i = 0; i < 8; i++) {
      fireEvent.press(getByTestId('onboarding-next-button'))
    }
    fireEvent.press(getByTestId('onboarding-next-button'))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('HELLO')
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@onboardingComplete', 'true')
    })
  })
})
