import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { StreakMilestone } from './index'

jest.mock('../StreakJournal', () => ({
  loadEntries: jest.fn().mockResolvedValue([]),
  getLocalDateString: jest.requireActual('../StreakJournal').getLocalDateString
}))

const mockedLoadEntries = require('../StreakJournal').loadEntries as jest.Mock

const buildEntries = (days: number) => {
  const { getLocalDateString } = require('../StreakJournal')
  const entries = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    entries.push({ date: getLocalDateString(date), text: `day ${i}` })
  }
  return entries
}

describe('<StreakMilestone />', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    mockedLoadEntries.mockReset()
  })

  it('shows the milestone card when the player reaches a 7-day streak', async () => {
    mockedLoadEntries.mockResolvedValue(buildEntries(7))
    const { getByText } = render(<StreakMilestone />)

    await waitFor(() => {
      expect(getByText('7-day streak!')).toBeTruthy()
    })
  })

  it('does not show the milestone card when the streak is below 7 days', async () => {
    mockedLoadEntries.mockResolvedValue(buildEntries(5))
    const { queryByText } = render(<StreakMilestone />)

    await waitFor(() => {
      expect(queryByText('7-day streak!')).toBeNull()
    })
  })

  it('does not repeat the milestone on the same day', async () => {
    const { getLocalDateString } = require('../StreakJournal')
    const today = getLocalDateString(new Date())
    await AsyncStorage.setItem('@streakMilestoneSeen', today)
    mockedLoadEntries.mockResolvedValue(buildEntries(7))

    const { queryByText } = render(<StreakMilestone />)

    await waitFor(() => {
      expect(queryByText('7-day streak!')).toBeNull()
    })
  })
})
