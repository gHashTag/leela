import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { WelcomeBack } from './index'

describe('<WelcomeBack />', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('shows when the player has been inactive for 7 days', async () => {
    const eightDaysAgo = new Date()
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
    await AsyncStorage.setItem('@lastAppOpen', String(eightDaysAgo.getTime()))

    const { getByText } = render(<WelcomeBack />)
    await waitFor(() => {
      expect(getByText('Welcome back')).toBeTruthy()
    })
  })

  it('does not show when the player opened the app yesterday', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await AsyncStorage.setItem('@lastAppOpen', String(yesterday.getTime()))

    const { queryByText } = render(<WelcomeBack />)
    await waitFor(() => {
      expect(queryByText('Welcome back')).toBeNull()
    })
  })

  it('does not show more than once per day', async () => {
    const eightDaysAgo = new Date()
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
    await AsyncStorage.setItem('@lastAppOpen', String(eightDaysAgo.getTime()))
    const todayString = new Date().toISOString().split('T')[0]
    await AsyncStorage.setItem('@welcomeBackSeen', todayString)

    const { queryByText } = render(<WelcomeBack />)
    await waitFor(() => {
      expect(queryByText('Welcome back')).toBeNull()
    })
  })
})
