import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { AiPersonaSelector } from './'
import { loadAiPersona, saveAiPersona } from '../../utils/aiPersona'

jest.mock('../../utils/aiPersona', () => ({
  ...jest.requireActual('../../utils/aiPersona'),
  loadAiPersona: jest.fn(),
  saveAiPersona: jest.fn()
}))

const mockedLoad = loadAiPersona as jest.Mock
const mockedSave = saveAiPersona as jest.Mock

describe('<AiPersonaSelector />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedLoad.mockResolvedValue('guru')
  })

  it('renders the three persona options', async () => {
    const { getByText } = render(<AiPersonaSelector />)

    await waitFor(() => {
      expect(getByText(/AI guide/)).toBeTruthy()
      expect(getByText(/scholar/i)).toBeTruthy()
      expect(getByText(/friend/i)).toBeTruthy()
      expect(getByText(/guru/i)).toBeTruthy()
    })
  })

  it('selects a different persona when pressed', async () => {
    const { getByText } = render(<AiPersonaSelector />)

    await waitFor(() => getByText(/scholar/i))
    fireEvent.press(getByText(/scholar/i))

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith('scholar')
    })
  })
})
