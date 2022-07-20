import { useFocusEffect, useTheme } from '@react-navigation/native'
import I18n from 'i18n-js'
import React from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { ButtonSimple, Space, Text } from '../../../components'
import AppLink from 'react-native-app-link'

export function UpdateVersionModal() {
  const {
    colors: { background }
  } = useTheme()

  useFocusEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true
    })
    return () => {
      backHandler.remove()
    }
  })

  const _onPress = () => {
    const options = {
      GooglePackageName: 'com.leelagame',
      OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
      preferInApp: false,
      openAppStoreIfInAppFails: true
    }
    AppLink.openInStore({
      appName: 'Leela Chakra',
      appStoreId: 1296604457,
      playStoreId: 'com.leelagame',
      appStoreLocale: 'en'
    })
  }
  return (
    <View style={container}>
      <View style={[modalView, { backgroundColor: background }]}>
        <Text textStyle={textStyle} title={I18n.t('updateApp')} h="h2" />
        <Space height={vs(30)} />
        <ButtonSimple onPress={_onPress} h="h3" title={I18n.t('update')} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalView: {
    margin: s(10),
    borderRadius: s(10),
    padding: s(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  textStyle: {
    alignItems: 'center'
  }
})
const { container, modalView, textStyle } = styles
