import React from 'react'
import { render } from '@testing-library/react-native'
import { LastMoveReplay } from './index'

describe('LastMoveReplay', () => {
  it('is defined', () => {
    expect(LastMoveReplay).toBeDefined()
  })

  it('renders without crashing when online history exists', () => {
    const { toJSON } = render(<LastMoveReplay />)
    expect(toJSON()).toBeTruthy()
  })
})
