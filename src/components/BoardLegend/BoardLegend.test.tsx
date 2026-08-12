import React from 'react'
import { render } from '@testing-library/react-native'
import { BoardLegend } from './index'

jest.mock('../../utils/useReducedMotion', () => ({
  useReducedMotion: () => false
}))

describe('BoardLegend', () => {
  it('is defined', () => {
    expect(BoardLegend).toBeDefined()
  })

  it('renders without crashing when visible', () => {
    const { toJSON } = render(
      <BoardLegend visible={true} onClose={jest.fn()} />
    )
    expect(toJSON()).toBeTruthy()
  })
})
