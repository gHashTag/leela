import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { AiFeedbackButtons } from './'
import { loadAiFeedback, saveAiFeedback } from '../../utils/aiFeedback'

jest.mock('../../utils/aiFeedback', () => ({
  ...jest.requireActual('../../utils/aiFeedback'),
  loadAiFeedback: jest.fn(),
  saveAiFeedback: jest.fn()
}))

const mockedLoad = loadAiFeedback as jest.Mock
const mockedSave = saveAiFeedback as jest.Mock

describe('<AiFeedbackButtons />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedLoad.mockResolvedValue(null)
  })

  it('renders both thumb buttons', async () => {
    const { findByLabelText } = render(<AiFeedbackButtons postId="post-1" />)

    expect(await findByLabelText('Thumbs up')).toBeTruthy()
    expect(await findByLabelText('Thumbs down')).toBeTruthy()
  })

  it('saves thumbs up when pressed', async () => {
    const { findByLabelText } = render(<AiFeedbackButtons postId="post-1" />)

    fireEvent.press(await findByLabelText('Thumbs up'))

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith('post-1', 'up')
    })
  })

  it('toggles off when the same button is pressed again', async () => {
    mockedLoad.mockResolvedValue('up')
    const { findByLabelText } = render(<AiFeedbackButtons postId="post-1" />)

    fireEvent.press(await findByLabelText('Thumbs up'))

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith('post-1', null)
    })
  })
})
