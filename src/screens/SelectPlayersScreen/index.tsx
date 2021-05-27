import React, { useCallback, useEffect } from 'react'
import { Button, Platform } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { v4 as uuidv4 } from 'uuid'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RootStackParamList } from '../../'
import { Background, ButtonsSlector, ModalSubscribe, Space } from '../../components'
import { actionsDice, actionsSubscribe, SubscribeStore } from '../../store'
import { LocalNotification } from '../../utils/noifications/LocalPushController'
import messaging from '@react-native-firebase/messaging'
import PushNotificationIOS from '@react-native-community/push-notification-ios'

type navigation = StackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const SelectPlayersScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const fetchBusinesses = useCallback(() => {
    const requestUserPermission = async () => {
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL

      if (enabled) {
        getFcmToken()
        console.log('Authorization status:', authStatus)
      }
    }
    requestUserPermission()
  }, [])

  // const getMessage = async () => {
  //   messaging().onMessage(payload => {
  //     console.log('Message received. ', payload)
  //     Platform.OS === 'ios'
  //       ? PushNotificationIOS.addNotificationRequest({
  //           id: '1',
  //           title: payload.notification?.title,
  //           body: payload.notification?.body
  //         })
  //       : LocalNotification(payload)
  //   })
  // }

  useEffect(() => {
    actionsSubscribe.purchaserInfo()
    //actionsSubscribe.setToday('12-6-21')
    const checkGame = async () => {
      const init = await AsyncStorage.getItem('@init')
      if (init === 'true') {
        navigation.navigate('MAIN')
      }
    }

    checkGame()
    fetchBusinesses()
    // getMessage()

    const unsubscribe = messaging().onMessage(async payload => {
      Platform.OS === 'ios'
        ? PushNotificationIOS.addNotificationRequest({
            id: uuidv4(),
            title: payload.notification?.title,
            body: payload.notification?.body
          })
        : LocalNotification(payload)
    })

    return unsubscribe
  }, [navigation, fetchBusinesses])

  const getFcmToken = async () => {
    const fcmToken = await messaging().getToken()
    if (fcmToken) {
      console.log('Your Firebase Token is:', fcmToken)
    } else {
      console.log('Failed', 'No token received')
    }
  }

  const selectPlayer = async (selectItem: number) => {
    if (selectItem + 1 === 1) {
      actionsDice.setPlayers(selectItem + 1)
      navigation.navigate('MAIN')
      actionsDice.init()
    } else {
      try {
        if (!SubscribeStore.subscriptionActive) {
          // Unlock that great "pro" content
          actionsDice.setPlayers(selectItem + 1)
          navigation.navigate('MAIN')
          actionsDice.init()
        } else {
          actionsSubscribe.setVisible(true)
        }
      } catch (error) {
        console.log('error', error)
      }
    }
  }

  const handleButtonPress = () => {
    //andrroid LocalNotification()
    Platform.OS === 'ios' &&
      PushNotificationIOS.addNotificationRequest({
        id: '1',
        title: 'Yoga time',
        body: 'Hello'
      })
  }

  return (
    <Background>
      <Space height={ms(50, 0.5)} />
      <ButtonsSlector onPress={selectPlayer} />
      <Space height={s(0)} />
      <ModalSubscribe />
      <Button title={'Local Push Notification'} onPress={handleButtonPress} />
    </Background>
  )
})

export { SelectPlayersScreen }
