import React from 'react'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { AiLanguageToggle } from './index'

jest.mock('../../utils/aiLanguage', () => ({
  getForceAiLanguage: jest.fn(),
  setForceAiLanguage: jest.fn()
}))

const { getForceAiLanguage, setForceAiLanguage } = jest.requireMock(
  '../../utils/aiLanguage'
)

describe('AiLanguageToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.clear()
  })

  it('renders toggle when preference loads', async () => {
    getForceAiLanguage.mockResolvedValue(false)
    const { getByRole } = render(<AiLanguageToggle />)

    await waitFor(() => {
      expect(getByRole('switch')).toBeTruthy()
    })
  })

  it('reflects enabled preference', async () => {
    getForceAiLanguage.mockResolvedValue(true)
    const { getByRole } = render(<AiLanguageToggle />)

    await waitFor(() => {
      expect(getByRole('switch').props.value).toBe(true)
    })
  })

  it('toggles preference on user interaction', async () => {
    getForceAiLanguage.mockResolvedValue(false)
    const { getByRole } = render(<AiLanguageToggle />)

    await waitFor(() => {
      expect(getByRole('switch').props.value).toBe(false)
    })

    fireEvent(getByRole('switch'), 'onValueChange', true)

    await waitFor(() => {
      expect(setForceAiLanguage).toHaveBeenCalledWith(true)
    })
  })
})
