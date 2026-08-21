import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { HapticToggle } from './index'

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn()
}))

const AsyncStorage = require('@react-native-async-storage/async-storage')

const mockSetHapticEnabled = jest.fn()
jest.mock('../../utils/haptics', () => ({
  setHapticEnabled: (value: boolean) => mockSetHapticEnabled(value)
}))

describe('<HapticToggle />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads the saved enabled state', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('false')
    const { getByLabelText } = render(<HapticToggle />)
    await waitFor(() => {
      const sw = getByLabelText(/haptic/i)
      expect(sw.props.value).toBe(false)
    })
    expect(mockSetHapticEnabled).toHaveBeenCalledWith(false)
  })

  it('toggles haptics off and persists', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('true')
    const { getByLabelText } = render(<HapticToggle />)
    await waitFor(() => {
      expect(getByLabelText(/haptic/i).props.value).toBe(true)
    })
    fireEvent(getByLabelText(/haptic/i), 'valueChange', false)
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@hapticEnabled',
        'false'
      )
    })
    expect(mockSetHapticEnabled).toHaveBeenLastCalledWith(false)
  })
})
