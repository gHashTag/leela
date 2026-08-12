import React from 'react'

import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { ThemeSelector } from './index'
import { setAppTheme } from '../../utils/themeSettings'

const mockStorage: Record<string, string> = {}
const mockSaveTheme = jest.fn()

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value
    return Promise.resolve()
  }),
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null))
}))

jest.mock('../../utils/haptics', () => ({
  triggerHaptic: jest.fn()
}))

jest.mock('../../utils/themeSettings', () => {
  const actual = jest.requireActual('../../utils/themeSettings')
  return {
    ...actual,
    saveThemePreference: jest.fn((theme: string) => {
      mockSaveTheme(theme)
      return Promise.resolve()
    })
  }
})

describe('<ThemeSelector />', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    mockSaveTheme.mockClear()
    setAppTheme('system')
  })

  it('renders theme options after loading', async () => {
    const { getByLabelText } = render(<ThemeSelector />)
    await waitFor(() => {
      expect(getByLabelText('System')).toBeTruthy()
      expect(getByLabelText('Light')).toBeTruthy()
      expect(getByLabelText('Dark')).toBeTruthy()
      expect(getByLabelText('High contrast')).toBeTruthy()
    })
  })

  it('selects high contrast and persists it', async () => {
    const { getByLabelText } = render(<ThemeSelector />)
    await waitFor(() => expect(getByLabelText('System')).toBeTruthy())

    fireEvent.press(getByLabelText('High contrast'))

    await waitFor(() => {
      expect(mockSaveTheme).toHaveBeenCalledWith('highContrast')
    })
  })

  it('toggles high contrast shortcut on and off', async () => {
    const { getByLabelText } = render(<ThemeSelector />)
    await waitFor(() => expect(getByLabelText('System')).toBeTruthy())

    const shortcut = getByLabelText('High contrast shortcut')
    fireEvent(shortcut, 'valueChange', true)

    await waitFor(() => {
      expect(mockSaveTheme).toHaveBeenCalledWith('highContrast')
    })

    fireEvent(shortcut, 'valueChange', false)

    await waitFor(() => {
      expect(mockSaveTheme).toHaveBeenLastCalledWith('system')
    })
  })
})
