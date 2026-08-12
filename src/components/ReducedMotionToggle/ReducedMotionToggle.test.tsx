import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { ReducedMotionToggle } from './index'

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn()
}))

const AsyncStorage = require('@react-native-async-storage/async-storage')

describe('<ReducedMotionToggle />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads the saved disabled state', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('false')
    const { getByLabelText } = render(<ReducedMotionToggle />)
    await waitFor(() => {
      expect(getByLabelText(/Reduce motion/i).props.value).toBe(false)
    })
  })

  it('toggles reduced motion on and persists', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('false')
    const { getByLabelText } = render(<ReducedMotionToggle />)
    await waitFor(() => {
      expect(getByLabelText(/Reduce motion/i).props.value).toBe(false)
    })
    fireEvent(getByLabelText(/Reduce motion/i), 'valueChange', true)
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@reducedMotionEnabled',
        'true'
      )
    })
  })
})
