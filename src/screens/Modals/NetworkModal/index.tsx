import React from 'react'

import { RouteProp, useFocusEffect, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import { BackHandler, View } from 'react-native'
import { ScaledSheet, s, vs } from 'react-native-size-matters'

import { ButtonSimple, Space, Text } from '../../../components'
import { OnlinePlayer } from '../../../store'
import { RootStackParamList } from '../../../types'

interface NetworkModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NETWORK_MODAL'>
  route: RouteProp<RootStackParamList, 'NETWORK_MODAL'>
}

export function NetworkModal({ navigation }: NetworkModalT) {
  const {
    colors: { background },
  } = useTheme()

  function onPress() {
    OnlinePlayer.SignOutToOffline()
    navigation.goBack()
    navigation.navigate('SELECT_PLAYERS_SCREEN')
  }

  useFocusEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onPress()
      return true
    })
    return () => {
      backHandler.remove()
    }
  })

  return (
    <View style={container}>
      <View style={[modalView, { backgroundColor: background }]}>
        <Text textStyle={textStyle} h={'h3'} title={I18n.t('disconnected')} />
        <Space height={vs(15)} />
        <ButtonSimple
          viewStyle={btnCont}
          h="h2"
          onPress={onPress}
          title={I18n.t('goOffline')}
        />
      </View>
    </View>
  )
}

const { container, modalView, btnCont, textStyle } = ScaledSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    margin: s(10),
    borderRadius: s(20),
    padding: s(30),
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
  btnCont: {
    alignItems: 'center',
  },
  textStyle: {
    textAlign: 'center',
  },
})
