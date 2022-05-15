import React, { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Sentry from '@sentry/react-native'
// import { requestTrackingPermission } from 'react-native-tracking-transparency'
import { ms, s } from 'react-native-size-matters'
// import * as Sentry from '@sentry/react-native'
import { RootStackParamList } from '../../types'
import {
  Background,
  ButtonsSlector,
  CenterView,
  ModalSubscribe,
  Space
} from '../../components'
import { actionsDice } from '../../store'
import AsyncStorage from '@react-native-async-storage/async-storage'
//import { LocalNotification } from '../../utils/noifications/LocalPushController'

type navigation = StackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const SelectPlayersScreen = observer(({ navigation }: SelectPlayersSceenT) => {
  useEffect(() => {
    const checkGame = async () => {
      const init = await AsyncStorage.getItem('@init')
      if (init === 'true') {
        navigation.navigate('MAIN')
      }
    }

    checkGame()
  }, [])

  const selectPlayer = async (selectItem: number) => {
    if (selectItem + 1 === 1) {
      actionsDice.setPlayers(selectItem + 1)
      navigation.navigate('MAIN')
      actionsDice.init()
      actionsDice.setOnline(false)
    } else {
      try {
        // if (SubscribeStore.subscriptionActive) {
        // Unlock that great "pro" content
        actionsDice.setPlayers(selectItem + 1)
        navigation.navigate('MAIN')
        actionsDice.init()
        actionsDice.setOnline(false)
        // } else {
        //   actionsSubscribe.setVisible(true)
        // }
      } catch (e) {
        Sentry.captureException(e)
      }
    }
    //}
  }

  return (
    <Background>
      <Space height={ms(20, 0.5)} />
      <ButtonsSlector onPress={selectPlayer} />
      <ModalSubscribe />
    </Background>
  )
})

export { SelectPlayersScreen }
