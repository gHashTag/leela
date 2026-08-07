import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { SoundToggle } from './'
import { loadSoundEnabled, saveSoundEnabled } from '../../utils/soundSettings'

jest.mock('../../utils/soundSettings', () => ({
  ...jest.requireActual('../../utils/soundSettings'),
  loadSoundEnabled: jest.fn(),
  saveSoundEnabled: jest.fn()
}))

const mockedLoad = loadSoundEnabled as jest.Mock
const mockedSave = saveSoundEnabled as jest.Mock

describe('<SoundToggle />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedLoad.mockResolvedValue(true)
  })

  it('renders the sound toggle card', async () => {
    const { getByRole } = render(<SoundToggle />)

    await waitFor(() => {
      expect(getByRole('switch')).toBeTruthy()
    })
  })

  it('toggles sound off', async () => {
    const { getByRole } = render(<SoundToggle />)

    await waitFor(() => getByRole('switch'))
    fireEvent(getByRole('switch'), 'valueChange', false)

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith(false)
    })
  })
})
