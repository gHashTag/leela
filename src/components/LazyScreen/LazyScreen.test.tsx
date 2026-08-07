import React from 'react'

import { render, waitFor } from '@testing-library/react-native'

import { LazyScreen } from './index'
import { Text } from '../TextComponents'

describe('LazyScreen', () => {
  it('renders the fallback while the screen is loading', () => {
    const neverResolves = () => new Promise(() => null)
    const { getByTestId } = render(
      <LazyScreen
        loader={neverResolves}
        testID="lazy-root"
      />
    )
    expect(getByTestId('lazy-root').children.length).toBeGreaterThan(0)
  })

  it('renders the loaded component once the promise resolves', async () => {
    const Loaded = () => <Text title="loaded" testID="loaded-text" />
    const { getByTestId } = render(
      <LazyScreen loader={() => Promise.resolve(Loaded)} />
    )
    await waitFor(() => expect(getByTestId('loaded-text')).toBeTruthy())
  })

  it('supports a default export from the loaded module', async () => {
    const Loaded = () => <Text title="default" testID="default-text" />
    const { getByTestId } = render(
      <LazyScreen loader={() => Promise.resolve({ default: Loaded })} />
    )
    await waitFor(() => expect(getByTestId('default-text')).toBeTruthy())
  })
})
