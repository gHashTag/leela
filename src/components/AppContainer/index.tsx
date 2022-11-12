import React from 'react'

import { StyleSheet, View } from 'react-native'

import { Background } from '../Background'
import { Header } from '../Header'

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
})

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
}

function AppContainer({
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
}: AppContainerT) {
  const { container } = styles
  return (
    <View style={container}>
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

export { AppContainer }
