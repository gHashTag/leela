import React from 'react'

import { RouteProp, useFocusEffect, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { lang } from 'src/i18n'

import { Space, Text } from '../../../components'
import { fuchsia } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { en } from '../../PlansScreen/en'
import { ru } from '../../PlansScreen/ru'

interface PlanReportModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
  route: RouteProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
}

export function PlanReportModal({ navigation, route }: PlanReportModalT) {
  const {
    colors: { background },
  } = useTheme()
  const { t } = useTranslation()

  const { plan } = route.params

  const list = lang === 'ru' ? ru : en
  const item = list.find(a => a.id === plan)

  useFocusEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => true)
    return listener.remove
  })
  const handlePress = () => {
    navigation.goBack()
    if (item) {
      navigation.navigate('PLANS_DETAIL_SCREEN', { ...item, report: true })
    }
  }
  return (
    <View style={page.transpCont}>
      <View style={[page.modalView, { backgroundColor: background }]}>
        <Text h="h4" textStyle={page.textStyle} title={t('online-part.makeReport')} />
        <Space height={vs(16)} />
        <TouchableOpacity onPress={handlePress}>
          <Text
            textStyle={page.linkText}
            title={t('actions.go')}
            oneColor={fuchsia}
            h="h2"
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const page = StyleSheet.create({
  transpCont: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    top: vs(22),
    margin: s(20),
    borderRadius: s(20),
    padding: s(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textStyle: {
    textAlign: 'center',
  },
  linkText: { textDecorationLine: 'underline' },
})
