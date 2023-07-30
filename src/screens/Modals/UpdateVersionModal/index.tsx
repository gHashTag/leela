import React from 'react'

import { useTheme } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import AppLink from 'react-native-app-link'
import { s, vs } from 'react-native-size-matters'

import { ButtonSimple, Space, Text } from '../../../components'
import { useNoBackHandler } from '../../../hooks'
import { black, blackOpacity } from '../../../constants'

export function UpdateVersionModal() {
  const {
    colors: { background }
  } = useTheme()
  useNoBackHandler()
  const { t } = useTranslation()

  const _onPress = () => {
    // const options = {
    //   GooglePackageName: 'com.leelagame',
    //   OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
    //   preferInApp: false,
    //   openAppStoreIfInAppFails: true,
    // }
    AppLink.openInStore({
      appName: 'Leela Chakra',
      appStoreId: 1296604457,
      playStoreId: 'com.leelagame',
      appStoreLocale: 'en'
    })
  }
  return (
    <View style={styles.container}>
      <View style={[styles.modalView, { backgroundColor: background }]}>
        <Text
          textStyle={styles.textStyle}
          title={t('modals.updateApp')}
          h="h2"
        />
        <Space height={vs(30)} />
        <ButtonSimple onPress={_onPress} h="h3" title={t('actions.update')} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: blackOpacity,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalView: {
    margin: s(10),
    borderRadius: s(10),
    padding: s(20),
    alignItems: 'center',
    shadowColor: black,
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
