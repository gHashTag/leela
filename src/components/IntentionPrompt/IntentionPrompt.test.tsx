import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { IntentionPrompt } from './'
import {
  loadTodayIntention,
  saveTodayIntention,
  clearTodayIntention
} from '../../utils/intention'

jest.mock('../../utils/intention', () => ({
  ...jest.requireActual('../../utils/intention'),
  loadTodayIntention: jest.fn(),
  saveTodayIntention: jest.fn(),
  clearTodayIntention: jest.fn()
}))

const mockedLoad = loadTodayIntention as jest.Mock
const mockedSave = saveTodayIntention as jest.Mock
const mockedClear = clearTodayIntention as jest.Mock

describe('<IntentionPrompt />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows the prompt when no intention is saved', async () => {
    mockedLoad.mockResolvedValue(null)
    const { getByText } = render(<IntentionPrompt />)

    await waitFor(() => {
      expect(getByText(/What is your intention for today's game?/)).toBeTruthy()
    })
  })

  it('hides the prompt when a saved intention exists', async () => {
    mockedLoad.mockResolvedValue('Play with kindness')
    const { queryByText } = render(<IntentionPrompt />)

    await waitFor(() => {
      expect(queryByText(/What is your intention for today's game?/)).toBeNull()
    })
  })

  it('saves the drafted intention on done', async () => {
    mockedLoad.mockResolvedValue(null)
    const { getByText, getByLabelText } = render(<IntentionPrompt />)

    await waitFor(() => getByText(/What is your intention for today's game?/))
    fireEvent.changeText(getByLabelText(/Your intention/i), 'Stay present')
    fireEvent.press(getByText(/Done/i))

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith('Stay present')
    })
  })

  it('clears the prompt when skipped', async () => {
    mockedLoad.mockResolvedValue(null)
    const { getByText } = render(<IntentionPrompt />)

    await waitFor(() => getByText(/What is your intention for today's game?/))
    fireEvent.press(getByText(/Skip/i))

    await waitFor(() => {
      expect(mockedClear).toHaveBeenCalled()
    })
  })
})
