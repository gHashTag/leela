import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import React from 'react'

import { OnboardingScreen, STEP_COUNT } from './index'

const mockReplace = jest.fn()
const mockNavigation = { replace: mockReplace } as any

describe('<OnboardingScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // The mock store is module-level and would otherwise leak the
    // `@onboardingComplete` flag from one test into the next.
    AsyncStorage.clear()
  })

  it('renders the first step counter', async () => {
    // Against the constant rather than a number written here twice: the count
    // is the screen's decision, and a test that restates it just breaks when
    // somebody changes their mind about it.
    //
    // The counter appears only after the screen has read the completion flag,
    // so the first assertion waits for it.
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    await waitFor(() => {
      expect(getByTestId('onboarding-step-counter').children[0]).toBe(
        `Step 1 of ${STEP_COUNT}`
      )
    })
  })

  it('advances the step counter when Next is pressed', async () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    await waitFor(() => getByTestId('onboarding-next-button'))
    fireEvent.press(getByTestId('onboarding-next-button'))
    expect(getByTestId('onboarding-step-counter').children[0]).toBe(
      `Step 2 of ${STEP_COUNT}`
    )
  })

  it('goes straight to the board when Skip is pressed', async () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    await waitFor(() => getByTestId('onboarding-skip-button'))
    fireEvent.press(getByTestId('onboarding-skip-button'))
    await waitFor(() => {
      // Was 'HELLO' - Sign in, Sign up, Select players, Play. The last thing a
      // player met after nine screens explaining the board was a form, and
      // nothing about throwing a die and writing about where it lands needs an
      // account. The auth screens are still registered and still reachable from
      // the profile; they are an offer now rather than a door.
      expect(mockReplace).toHaveBeenCalledWith('MAIN', {
        screen: 'TAB_BOTTOM_0'
      })
    })
  })

  it('completes onboarding on the last step', async () => {
    const { getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    await waitFor(() => getByTestId('onboarding-next-button'))
    for (let i = 0; i < 8; i++) {
      fireEvent.press(getByTestId('onboarding-next-button'))
    }
    fireEvent.press(getByTestId('onboarding-next-button'))
    await waitFor(() => {
      // Was 'HELLO' - Sign in, Sign up, Select players, Play. The last thing a
      // player met after nine screens explaining the board was a form, and
      // nothing about throwing a die and writing about where it lands needs an
      // account. The auth screens are still registered and still reachable from
      // the profile; they are an offer now rather than a door.
      expect(mockReplace).toHaveBeenCalledWith('MAIN', {
        screen: 'TAB_BOTTOM_0'
      })
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@onboardingComplete',
        'true'
      )
    })
  })

  it('skips itself on a later launch once the flag is set', async () => {
    // The flag was always written on completion and never read back, so all
    // nine steps replayed on every launch. A returning player must land on
    // the board without seeing a single step card.
    await AsyncStorage.setItem('@onboardingComplete', 'true')
    const { queryByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} />
    )
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('MAIN', {
        screen: 'TAB_BOTTOM_0'
      })
    })
    expect(queryByTestId('onboarding-step-counter')).toBeNull()
  })
})
