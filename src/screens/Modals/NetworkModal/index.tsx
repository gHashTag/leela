import { RouteProp, useFocusEffect, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import React from 'react'
import { BackHandler, View } from 'react-native'
import { s, ScaledSheet, vs } from 'react-native-size-matters'
import { ButtonSimple, Space, Text } from '../../../components'
import { OnlinePlayer } from '../../../store'
import { RootStackParamList } from '../../../types'

interface NetworkModalT {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NETWORK_MODAL'>
  route: RouteProp<RootStackParamList, 'NETWORK_MODAL'>
}

export function NetworkModal({ navigation }: NetworkModalT) {
  const {
    colors: { background }
  } = useTheme()

  useFocusEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onPress()
      return true
    })
    return () => {
      backHandler.remove()
    }
  })

  function onPress() {
    OnlinePlayer.SignOutToOffline()
    navigation.navigate('SELECT_PLAYERS_SCREEN')
  }
  return (
    <View style={container}>
      <View style={[modalView, { backgroundColor: background }]}>
        <Text h={'h3'} title={I18n.t('disconnected')} />
        <Space height={20} />
        <ButtonSimple h="h1" onPress={onPress} title={I18n.t('goOffline')} />
      </View>
    </View>
  )
}

const { container, modalView } = ScaledSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalView: {
    top: vs(22),
    margin: s(20),
    borderRadius: s(20),
    padding: s(35),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  }
})
