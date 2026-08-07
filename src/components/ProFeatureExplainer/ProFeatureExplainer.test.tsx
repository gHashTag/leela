import React from 'react'
import { render } from '@testing-library/react-native'
import { ProFeatureExplainer } from './index'

describe('ProFeatureExplainer', () => {
  it('is defined', () => {
    expect(ProFeatureExplainer).toBeDefined()
  })

  it('renders without crashing when visible', () => {
    const { toJSON } = render(<ProFeatureExplainer visible={true} onClose={jest.fn()} />)
    expect(toJSON()).not.toBeNull()
  })

  it('renders without crashing when not visible', () => {
    const { toJSON } = render(<ProFeatureExplainer visible={false} onClose={jest.fn()} />)
    expect(toJSON()).toBeTruthy()
  })
})
