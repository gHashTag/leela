import React from 'react'
import { render } from '@testing-library/react-native'

import { WeeklyStreak } from './'

jest.mock('../../components/StreakJournal', () => ({
  loadEntries: jest.fn().mockResolvedValue([
    { date: '2026-01-07', text: 'entry' }
  ]),
  getLocalDateString: jest.requireActual('../../components/StreakJournal').getLocalDateString
}))

describe('<WeeklyStreak />', () => {
  it('renders the streak title and seven day dots', () => {
    const { getByText, getAllByTestId } = render(<WeeklyStreak />)

    expect(getByText(/This week/)).toBeTruthy()
    expect(getAllByTestId('day-dot')).toHaveLength(7)
  })
})
