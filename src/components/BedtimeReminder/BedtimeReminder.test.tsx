import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { BedtimeReminder } from './'
import {
  loadBedtimeReminder,
  saveBedtimeReminder,
  scheduleBedtimeReminder
} from '../../utils/notifications/bedtimeReminder'

jest.mock('../../utils/notifications/bedtimeReminder', () => ({
  ...jest.requireActual('../../utils/notifications/bedtimeReminder'),
  loadBedtimeReminder: jest.fn(),
  saveBedtimeReminder: jest.fn(),
  scheduleBedtimeReminder: jest.fn()
}))

const mockedLoad = loadBedtimeReminder as jest.Mock
const mockedSave = saveBedtimeReminder as jest.Mock
const mockedSchedule = scheduleBedtimeReminder as jest.Mock

describe('<BedtimeReminder />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedLoad.mockResolvedValue({ enabled: false, hour: 21, minute: 0 })
  })

  it('renders the default bedtime reminder card', async () => {
    const { getByText } = render(<BedtimeReminder />)

    await waitFor(() => {
      expect(getByText(/Gentle bedtime reminder/)).toBeTruthy()
      expect(getByText('21:00')).toBeTruthy()
    })
  })

  it('increases the reminder hour', async () => {
    const { getByText, getByLabelText } = render(<BedtimeReminder />)

    await waitFor(() => getByText('21:00'))
    fireEvent.press(getByLabelText(/Increase reminder hour/i))

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith(
        expect.objectContaining({ hour: 22, enabled: false })
      )
      expect(mockedSchedule).toHaveBeenCalled()
    })
  })

  it('toggles the reminder on', async () => {
    const { getByRole } = render(<BedtimeReminder />)

    await waitFor(() => getByRole('switch'))
    fireEvent(getByRole('switch'), 'valueChange', true)

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      )
      expect(mockedSchedule).toHaveBeenCalled()
    })
  })
})
