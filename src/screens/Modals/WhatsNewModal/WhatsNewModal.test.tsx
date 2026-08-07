import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

import { WhatsNewModal } from './'

const mockGoBack = jest.fn()

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useTheme: () => ({ colors: { background: '#ffffff' } })
}))

describe('<WhatsNewModal />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders title, version and changelog items', () => {
    const { getByText } = render(<WhatsNewModal />)

    expect(getByText("What's new")).toBeTruthy()
    expect(getByText(/Version/)).toBeTruthy()
    expect(getByText('Close')).toBeTruthy()
  })

  it('navigates back when close button is pressed', () => {
    const { getByText } = render(<WhatsNewModal />)

    fireEvent.press(getByText('Close'))
    expect(mockGoBack).toHaveBeenCalled()
  })
})
