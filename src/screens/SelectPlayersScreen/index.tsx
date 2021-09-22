import React from 'react'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
// import { requestTrackingPermission } from 'react-native-tracking-transparency'
import { ms, s } from 'react-native-size-matters'
// import * as Sentry from '@sentry/react-native'
import { RootStackParamList } from '../../'
import { Background, ButtonsSlector, ModalSubscribe, Space } from '../../components'
import { actionsDice } from '../../store'


type navigation = StackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const SelectPlayersScreen = observer(({ navigation }: SelectPlayersScreenT) => {

  const selectPlayer = async (selectItem: number) => {
    console.log(`selectItem`, selectItem)
    actionsDice.setPlayers(selectItem + 1)
    navigation.navigate('MAIN')
    actionsDice.init()
    // const trackingStatus = await requestTrackingPermission()

    // if (trackingStatus === 'authorized' || trackingStatus === 'unavailable') {
    //   if (selectItem + 1 === 1) {
    //     actionsDice.setPlayers(selectItem + 1)
    //     navigation.navigate('MAIN')
    //     actionsDice.init()
    //   } else {
    //     try {
    //       if (SubscribeStore.subscriptionActive) {
    //         // Unlock that great "pro" content
    //         actionsDice.setPlayers(selectItem + 1)
    //         navigation.navigate('MAIN')
    //         actionsDice.init()
    //       } else {
    //         actionsSubscribe.setVisible(true)
    //       }
    //     } catch (e) {
    //       Sentry.captureException(e)
    //     }
    //   }
    //}
  }

  return (
    <Background>
      <Space height={ms(50, 0.5)} />
      <ButtonsSlector onPress={selectPlayer} />
      <Space height={s(0)} />
      <ModalSubscribe />
    </Background>
  )
})

export { SelectPlayersScreen }
