import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Header } from '../Header'
import { Background } from '../Background'
import { SafeAreaView } from 'react-native-safe-area-context'

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%'
  }
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
  displayStatus,
  iconLeftOpacity = 1,
  textAlign = 'left',
  status
}: AppContainerT) {
  const { container } = styles
  return (
    <View style={{ flex: 1 }}>
      <Background status={status}>
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
          {children}
        </View>
      </Background>
    </View>
  )
}

export { AppContainer }
