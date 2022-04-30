import React from 'react'
import { StyleSheet, View } from 'react-native'
// @ts-expect-error
import StatusBarAlert from 'react-native-statusbar-alert'
import { Header } from '../Header'
import { Background } from '../Background'
import { SafeAreaView } from 'react-native-safe-area-context'

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%'
  },
  statusStyle: { padding: 5, paddingTop: 5 }
})

const RED = '#FC2847'

interface AppContainerT {
  iconLeft?: string | null
  colorLeft?: string
  onPress?: () => void
  onPressRight?: () => void
  iconRight?: string
  children?: React.ReactNode
  message?: string
  title?: string
  header?: boolean
  textAlign?: 'center' | 'auto' | 'left' | 'right' | 'justify'
  status?: 'bg' | 'clean' | '1x1'
}

function AppContainer({
  iconLeft = ':back:',
  onPress,
  onPressRight,
  header = true,
  iconRight,
  children,
  message = '',
  title,
  textAlign = 'left',
  status
}: AppContainerT) {
  const { container, statusStyle } = styles
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Background status={status}>
        <View style={container}>
          <StatusBarAlert
            visible={message !== ''}
            message={message}
            backgroundColor={RED}
            color="white"
            pulse="background"
            height={40}
            style={statusStyle}
          />
          {title && header && (
            <Header
              textAlign={textAlign}
              title={title}
              onPress={onPress}
              onPressRight={onPressRight}
              iconLeft={iconLeft}
              iconRight={iconRight}
            />
          )}
          {children}
        </View>
      </Background>
    </SafeAreaView>
  )
}

export { AppContainer }
