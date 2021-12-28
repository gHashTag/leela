import React, { memo } from 'react'
import { StyleSheet, View, ScrollView, SafeAreaView } from 'react-native'
import StatusBarAlert from 'react-native-statusbar-alert'
import { Header } from '../Header'
import { Space } from '../Space'
import { Spin } from '../Spin'
import { Background } from '../Background'
import { Loading } from '..'

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%'
  },
  sub: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusStyle: { padding: 5, paddingTop: 5 }
})

const RED = '#FC2847'

interface AppContainerT {
  admin?: boolean
  flatList?: boolean
  iconLeft?: string | null
  backgroundColor?: string
  colorLeft?: string
  onPress?: () => void
  onPressRight?: () => void
  iconRight?: string
  colorRight?: string
  children?: React.ReactNode
  message?: string
  title?: string
  loading?: boolean
  header?: boolean
  textAlign?: string | null
  status?: string
}

const AppContainer = memo<AppContainerT>(
  ({
    admin = false,
    flatList = false,
    iconLeft = ':back:',
    onPress = null,
    onPressRight = null,
    header = true,
    iconRight,
    children,
    message = '',
    title,
    loading = false,
    textAlign = 'left',
    status
  }) => {
    const { container, sub, statusStyle } = styles
    return (
      <SafeAreaView>
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
                admin={admin}
              />
            )}
            <>
              {loading ? (
                <Loading loading={loading} />
              ) : (
                <>
                  {!flatList ? (
                    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                      <View style={sub}>{children}</View>
                      <Space height={100} />
                    </ScrollView>
                  ) : (
                    <View style={sub}>{children}</View>
                  )}
                </>
              )}
            </>
          </View>
        </Background>
      </SafeAreaView>
    )
  }
)

export { AppContainer }
