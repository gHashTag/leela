import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { FollowUpQuestions } from './'
import { navigate } from '../../constants'
import { PostStore } from '../../store'

jest.mock('../../constants', () => ({
  ...jest.requireActual('../../constants'),
  navigate: jest.fn()
}))

jest.mock('../../utils/followUpQuestions', () => ({
  getFollowUpQuestions: () => [
    'How does this apply today?',
    'What scripture deepens this?'
  ]
}))

describe('<FollowUpQuestions />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    PostStore.store.posts = [{ id: 'post-1', ownerId: 'owner-1' } as any]
  })

  it('renders the section title, chips and freeform button', () => {
    const { getByText } = render(<FollowUpQuestions postId="post-1" />)

    expect(getByText(/Continue the reflection/i)).toBeTruthy()
    expect(getByText(/How does this apply today?/i)).toBeTruthy()
    expect(getByText(/What scripture deepens this?/i)).toBeTruthy()
    expect(getByText(/Ask your own question/i)).toBeTruthy()
  })

  it('opens the input modal with the selected question', async () => {
    const { getByText } = render(<FollowUpQuestions postId="post-1" />)

    fireEvent.press(getByText(/How does this apply today?/))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        'INPUT_TEXT_MODAL',
        expect.objectContaining({
          initialText: 'How does this apply today?'
        })
      )
    })
  })

  it('opens the input modal with empty text for freeform follow-up', async () => {
    const { getByText } = render(<FollowUpQuestions postId="post-1" />)

    fireEvent.press(getByText(/Ask your own question/i))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        'INPUT_TEXT_MODAL',
        expect.objectContaining({
          initialText: ''
        })
      )
    })
  })
})
