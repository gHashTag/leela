import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { ButtonSimple, Space, Text } from '../../../components'
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
  const handlePress = () => {
    navigation.goBack()
    if (item) {
      navigation.navigate('PLANS_DETAIL_SCREEN', { ...item, report: true })
    }
  }
  return (
    <View style={transpCont}>
      <View style={[modalView, { backgroundColor: background }]}>
        <Text h="h2" title={I18n.t('makeReport')} />
        <Space height={vs(10)} />
        <ButtonSimple
          viewStyle={btnCont}
          onPress={handlePress}
          h="h2"
          title={I18n.t('go')}
        />
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
  btnCont: {
    alignItems: 'flex-end'
  }
})

const { transpCont, modalView, btnCont } = styles
