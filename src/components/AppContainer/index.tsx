import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Background } from '../Background'
import { Header } from '../Header'

interface AppContainerT {
  iconLeft?: string | null
  colorLeft?: string
  onPress?: () => void
  onPressRight?: () => void
  iconRight?: string | null
  children?: React.ReactNode
  message?: string
  title?: string
  displayStatus?: boolean
  enableBackgroundBottomInsets?: boolean
  enableBackgroundTopInsets?: boolean
  header?: boolean
  iconLeftOpacity?: number
  textAlign?: 'center' | 'auto' | 'left' | 'right' | 'justify'
  status?: 'bg' | 'clean' | '1x1'
  hidestar?: boolean
}

export function AppContainer({
  iconLeft = null,
  onPress,
  onPressRight,
  header = true,
  iconRight = null,
  children,
  title,
  enableBackgroundBottomInsets,
  enableBackgroundTopInsets,
  displayStatus,
  iconLeftOpacity = 1,
  textAlign = 'left',
  status,
  hidestar = false,
}: AppContainerT) {
  return (
    <View style={page.container}>
      {title && header && (
        <Header
          displayStatus={displayStatus}
          textAlign={textAlign}
          title={title}
          onPress={onPress}
          iconLeftOpacity={iconLeftOpacity}
          onPressRight={onPressRight}
          iconLeft={iconLeft}
          iconRight={iconRight}
          hidestar={hidestar}
        />
      )}
      <Background
        enableTopInsets={enableBackgroundTopInsets}
        enableBottomInsets={enableBackgroundBottomInsets}
        status={status}
      >
        {children}
      </Background>
    </View>
  )
}

const page = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
})
