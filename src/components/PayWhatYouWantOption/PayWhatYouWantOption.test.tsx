import React from 'react'
import { render } from '@testing-library/react-native'
import { PayWhatYouWantOption } from './index'

describe('PayWhatYouWantOption', () => {
  it('is defined', () => {
    expect(PayWhatYouWantOption).toBeDefined()
  })

  it('renders without crashing', () => {
    const { toJSON } = render(<PayWhatYouWantOption selectedPackage={null} />)
    expect(toJSON()).toBeNull()
  })
})
