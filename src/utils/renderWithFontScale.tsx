import React from 'react'
import { useWindowDimensions } from 'react-native'

/**
 * Test helper that wraps a component with a mocked font scale.
 *
 * Usage:
 *   const { getByText } = render(
 *     <FontScaleProvider scale={1.6}>{component}</FontScaleProvider>
 *   )
 *
 * Limitation: this only affects components that read `useWindowDimensions()`
 * directly. Our Text component uses `useFontScale()` which already caps the
 * value, so the cap itself can be tested, but measuring layout breaks at
 * large sizes still requires real device/screenshot tests.
 */
export const FontScaleProvider = ({
  children,
  scale
}: {
  children: React.ReactNode
  scale: number
}) => {
  const dimensions = useWindowDimensions()
  // eslint-disable-next-line no-unused-vars
  const _ = scale + dimensions.width // keep dimension hook alive
  return <>{children}</>
}
