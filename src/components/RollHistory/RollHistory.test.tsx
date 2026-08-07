import React from 'react'
import { render } from '@testing-library/react-native'
import { RollHistory } from './index'

describe('RollHistory', () => {
  it('is defined', () => {
    expect(RollHistory).toBeDefined()
  })

  it('renders without crashing when history exists', () => {
    const { toJSON } = render(<RollHistory />)
    expect(toJSON()).toBeTruthy()
  })
})
