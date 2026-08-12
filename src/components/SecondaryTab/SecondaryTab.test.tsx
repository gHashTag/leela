import React from 'react'
import { render } from '@testing-library/react-native'

import { SecondaryTab } from './index'

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons')

describe('<SecondaryTab />', () => {
  it('renders tabs with accessibility roles', () => {
    const { getAllByRole } = render(
      <SecondaryTab
        jumpTo={jest.fn()}
        navigationState={{
          index: 0,
          routes: [
            { key: 'history', title: 'History' },
            { key: 'reports', title: 'Reports' }
          ]
        }}
        width={320}
      />
    )
    const tabs = getAllByRole('tab')
    expect(tabs.length).toBe(2)
  })
})
