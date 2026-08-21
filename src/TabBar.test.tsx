import React from 'react'

import { fireEvent, render } from '@testing-library/react-native'
import { I18nManager } from 'react-native'

import { TabBar } from './TabBar'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 10, left: 0, right: 0 })
}))

const mockNavigate = jest.fn()
const mockEmit = jest.fn()

const baseState = {
  index: 0,
  routes: [
    { key: 'tab-0', name: 'TAB_BOTTOM_0' },
    { key: 'tab-1', name: 'TAB_BOTTOM_2' }
  ]
}

const baseNavigation = {
  emit: mockEmit,
  navigate: mockNavigate
}

describe('TabBar', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockEmit.mockClear()
    mockEmit.mockReturnValue({ defaultPrevented: false })
  })

  it('renders a tablist with one tab per route', () => {
    const { getAllByRole } = render(
      <TabBar state={baseState} navigation={baseNavigation as any} />
    )
    const tabs = getAllByRole('tab')
    expect(tabs).toHaveLength(2)
  })

  it('labels tabs with localized route names', () => {
    // Read 'Game board' until the app's front door became the board in three
    // dimensions: `TAB_BOTTOM_0` is `BoardScreen` now and the flat grid moved
    // to `TAB_BOTTOM_3`. What is under test is that a tab is *labelled from
    // the catalogue* rather than showing its route name, not which screen
    // happens to be first — but the label is read from the real map, so it
    // moves with the app rather than describing a version of it.
    const { getByRole } = render(
      <TabBar state={baseState} navigation={baseNavigation as any} />
    )
    const first = getByRole('tab', { name: 'Board 3D' })
    expect(first).toBeTruthy()
  })

  it('navigates when an inactive tab is pressed', () => {
    const { getAllByRole } = render(
      <TabBar state={baseState} navigation={baseNavigation as any} />
    )
    const tabs = getAllByRole('tab')
    fireEvent.press(tabs[1])
    expect(mockNavigate).toHaveBeenCalledWith('MAIN', {
      screen: 'TAB_BOTTOM_2',
      merge: true
    })
  })

  it('does not navigate when the active tab is pressed', () => {
    const { getAllByRole } = render(
      <TabBar state={baseState} navigation={baseNavigation as any} />
    )
    const tabs = getAllByRole('tab')
    fireEvent.press(tabs[0])
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('reverses the tab container direction in RTL mode', () => {
    I18nManager.isRTL = true
    const { getByTestId } = render(
      <TabBar state={baseState} navigation={baseNavigation as any} />
    )
    const tablist = getByTestId('tab-bar-container')
    const styleArray = Array.isArray(tablist.props.style)
      ? tablist.props.style
      : [tablist.props.style]
    const flattened = Object.assign({}, ...styleArray)
    expect(flattened.flexDirection).toBe('row-reverse')
    I18nManager.isRTL = false
  })
})
