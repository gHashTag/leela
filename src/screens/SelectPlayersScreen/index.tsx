import React, { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import Config from 'react-native-config'
import { ms, s } from 'react-native-size-matters'
import { v4 as uuidv4 } from 'uuid'
import firestore from '@react-native-firebase/firestore'
import messaging from '@react-native-firebase/messaging'
import auth from '@react-native-firebase/auth'
import * as Sentry from '@sentry/react-native'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import { getUniqueId } from 'react-native-device-info'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RootStackParamList } from '../../'
import { lang } from '../../utils'
import { Background, ButtonsSlector, ModalSubscribe, Space } from '../../components'
import { actionsDice, actionsSubscribe, SubscribeStore } from '../../store'
import { LocalNotification } from '../../utils/noifications/LocalPushController'

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
        // Get the device token
        messaging()
          .getToken()
          .then(token => {
            // console.log('Authorization status:', token)
            return saveTokenToDatabase(token)
          })

        // Listen to whether the token changes
        return messaging().onTokenRefresh(token => {
          saveTokenToDatabase(token)
        })
      }
    }
    requestUserPermission()
  }, [])

  const saveTokenToDatabase = async (token: string) => {
    // Assume user is already signed in
    const uniqueId = getUniqueId()
    // Add the token to the users datastore
    try {
      await firestore()
        .collection('users')
        .doc(uniqueId)
        .set({
          tokens: firestore.FieldValue.arrayUnion(token),
          lang: firestore.FieldValue.arrayUnion(lang)
        })
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  useEffect(() => {
    //console.warn('SubscribeStore.subscriptionActive', SubscribeStore.subscriptionActive)
    auth().signInWithEmailAndPassword(Config.ADMIN, Config.ADMIN_PASSWORD)

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

    const unsubscribe = messaging().onMessage(async payload => {
      Platform.OS === 'ios'
        ? PushNotificationIOS.addNotificationRequest({
            id: uuidv4(),
            title: payload.data?.title,
            body: payload.data?.body
          })
        : LocalNotification(payload)
    })

    return unsubscribe
  }, [navigation, fetchBusinesses])

  const selectPlayer = async (selectItem: number) => {
    if (selectItem + 1 === 1) {
      actionsDice.setPlayers(selectItem + 1)
      navigation.navigate('MAIN')
      actionsDice.init()
    } else {
      try {
        if (SubscribeStore.subscriptionActive) {
          // Unlock that great "pro" content
          actionsDice.setPlayers(selectItem + 1)
          navigation.navigate('MAIN')
          actionsDice.init()
        } else {
          actionsSubscribe.setVisible(true)
        }
      } catch (e) {
        Sentry.captureException(e)
      }
    }
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
