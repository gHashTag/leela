import React from 'react'

import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { BackHandler, Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../../components'
import { fuchsia, primary } from '../../../constants'
import { RootStackParamList } from '../../../types/types'

interface ExitPopupT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'INPUT_TEXT_MODAL'>
  route: RouteProp<RootStackParamList, 'EXIT_MODAL'>
}

export function ExitPopup({ navigation }: ExitPopupT) {
  const {
    colors: { background }
  } = useTheme()
  const { t } = useTranslation()

  function cancel() {
    navigation.goBack()
  }
  function exit() {
    BackHandler.exitApp()
  }
  return (
    <View style={styles.transparentView}>
      <Pressable style={styles.exitArea} onPress={() => navigation.goBack()} />
      <View style={[styles.popup, { backgroundColor: background }]}>
        <Text textStyle={styles.btnText} title={t('modals.wantExit')} h="h2" />
        <Space height={vs(20)} />
        <View style={styles.btnsCont}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { borderBottomLeftRadius: s(12) },
              pressed && styles.pressedBtn
            ]}
            onPress={exit}
          >
            <Text
              oneColor={fuchsia}
              textStyle={styles.btnText}
              title={t('actions.exit')}
              h="h2"
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { borderBottomRightRadius: s(12) },
              pressed && styles.pressedBtn
            ]}
            onPress={cancel}
          >
            <Text
              oneColor={primary}
              textStyle={styles.btnText}
              title={t('actions.cancel')}
              h="h2"
            />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  transparentView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  popup: {
    width: '75%',
    borderRadius: s(4),
    borderBottomRightRadius: s(12),
    borderBottomLeftRadius: s(12),
    justifyContent: 'space-between',
    paddingTop: vs(14),
    shadowColor: fuchsia,
    shadowOffset: {
      width: 0,
      height: 5
    },
    shadowOpacity: 0.51,
    shadowRadius: 13.16,
    elevation: 20
  },
  exitArea: {
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  btnsCont: {
    flexDirection: 'row'
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    padding: s(7)
  },
  pressedBtn: {
    transform: [{ translateY: vs(-2) }]
  },
  btnText: {
    textAlign: 'center',
    marginHorizontal: s(8)
  }
})
