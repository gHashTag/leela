import React from 'react'

import { RouteProp, useFocusEffect, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { BackHandler, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../../components'
import { Pressable } from '../../../components/Pressable'
import { black, blackOpacity, fuchsia } from '../../../constants'
import { RootStackParamList } from '../../../types/types'

interface PlanReportModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
  route: RouteProp<RootStackParamList, 'PLAN_REPORT_MODAL'>
}

export function PlanReportModal({ navigation, route }: PlanReportModalT) {
  const {
    colors: { background }
  } = useTheme()
  const { t } = useTranslation()

  const { plan } = route.params

  useFocusEffect(() => {
    const listener = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    )
    return listener.remove
  })
  const handlePress = () => {
    navigation.goBack()
    if (plan) {
      navigation.navigate('PLANS_DETAIL_SCREEN', { plan, report: true })
    }
  }
  return (
    <View style={styles.transpCont}>
      <View style={[styles.modalView, { backgroundColor: background }]}>
        <Text
          h="h4"
          textStyle={styles.textStyle}
          title={t('online-part.makeReport')}
        />
        <Space height={vs(16)} />
        <Pressable onPress={handlePress}>
          <Text
            textStyle={styles.linkText}
            title={t('actions.go')}
            oneColor={fuchsia}
            h="h2"
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  transpCont: {
    height: '100%',
    width: '100%',
    backgroundColor: blackOpacity,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalView: {
    top: vs(22),
    margin: s(20),
    borderRadius: s(20),
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
    textAlign: 'center'
  },
  linkText: { textDecorationLine: 'underline' }
})
