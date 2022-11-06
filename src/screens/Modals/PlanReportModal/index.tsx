import { RouteProp, useFocusEffect, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import React from 'react'
import { BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { Space, Text } from '../../../components'
import { fuchsia } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { lang } from '../../../utils'
import { en } from '../../PlansScreen/en'
import { ru } from '../../PlansScreen/ru'

interface PlanReportModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
  route: RouteProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
}

export function PlanReportModal({ navigation, route }: PlanReportModalT) {
  const {
    colors: { background }
  } = useTheme()
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
    <View style={transpCont}>
      <View style={[modalView, { backgroundColor: background }]}>
        <Text h="h4" textStyle={textStyle} title={I18n.t('makeReport')} />
        <Space height={vs(16)} />
        <TouchableOpacity onPress={handlePress}>
          <Text
            textStyle={{ textDecorationLine: 'underline' }}
            title={I18n.t('go')}
            oneColor={fuchsia}
            h="h2"
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  transpCont: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center'
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
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  textStyle: {
    textAlign: 'center'
  }
})

const { transpCont, modalView, textStyle } = styles
