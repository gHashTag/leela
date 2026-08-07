import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { TutorialOverlay } from './index'

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() })
}))

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

describe('<TutorialOverlay />', () => {
  it('renders the first tutorial step', async () => {
    const { getByText } = render(<TutorialOverlay />)
    await waitFor(() => {
      expect(getByText('How to play')).toBeTruthy()
    })
  })

  it('advances to the next step', async () => {
    const { getByText } = render(<TutorialOverlay />)
    await waitFor(() => getByText('How to play'))
    fireEvent.press(getByText('Next'))
    await waitFor(() => {
      expect(getByText('Roll the dice')).toBeTruthy()
    })
  })

  it('can be skipped and hidden', async () => {
    const { getByText, queryByText } = render(<TutorialOverlay />)
    await waitFor(() => getByText('How to play'))
    fireEvent.press(getByText('Skip'))
    await waitFor(() => {
      expect(queryByText('How to play')).toBeNull()
    })
  })
})
