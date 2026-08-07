import React, { ComponentType, useEffect, useState } from 'react'
import { View } from 'react-native'

import { Fallback } from '../Fallback'

export type LazyScreenLoader<T = Record<string, unknown>> = () => Promise<
  { default: ComponentType<T> } | ComponentType<T>
>

export interface LazyScreenProps<T = Record<string, unknown>> {
  loader: LazyScreenLoader<T>
  testID?: string
}

export function LazyScreen<T = Record<string, unknown>>({
  loader,
  testID,
  ...props
}: LazyScreenProps<T> & T) {
  const [Screen, setScreen] = useState<ComponentType<T> | null>(null)

  useEffect(() => {
    let mounted = true
    loader()
      .then((mod) => {
        if (!mounted) return
        const Component =
          mod && typeof mod === 'object' && 'default' in mod
            ? (mod as { default: ComponentType<T> }).default
            : (mod as ComponentType<T>)
        setScreen(() => Component)
      })
      .catch(() => {
        // Keep showing the fallback on load failure. Navigation-level error
        // boundaries or retry are outside this minimal splitting helper.
      })
    return () => {
      mounted = false
    }
  }, [loader])

  if (!Screen) {
    return (
      <View testID={testID}>
        <Fallback />
      </View>
    )
  }

  return <Screen {...(props as T)} />
}

export function lazyScreen<T = Record<string, unknown>>(
  loader: LazyScreenLoader<T>
): ComponentType<T> {
  return function LazyScreenWrapper(props: T) {
    return <LazyScreen loader={loader} {...props} />
  }
}
