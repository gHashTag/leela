import React, { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Keychain from 'react-native-keychain'
import { s } from 'react-native-size-matters'
import { v4 as uuidv4 } from 'uuid'
import firestore from '@react-native-firebase/firestore'
import messaging from '@react-native-firebase/messaging'
import auth from '@react-native-firebase/auth'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import { getUniqueId } from 'react-native-device-info'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScaledSheet } from 'react-native-size-matters'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../types'
import { AppContainer, ModalSubscribe, Space, Button, Txt, CenterView, IconLeela } from '../../components'
import { actionsSubscribe, actionsDice, actionPlayers, DiceStore } from '../../store'
import { LocalNotification } from '../../utils/noifications/LocalPushController'
import { captureException } from '../../constants'

type navigation = StackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const styles = ScaledSheet.create({
  h6: { alignSelf: 'center' }
})

const WelcomeScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const [loading, setLoading] = useState<boolean>(false)

  const key = async (): Promise<void> => {
    try {
      // await Keychain.resetInternetCredentials('auth')
      // await AsyncStorage.clear()
      const credentials = await Keychain.getInternetCredentials('auth')
      if (credentials) {
        const { username, password } = credentials
        auth().signInWithEmailAndPassword(username, password).then(user => {
          if (user.user.emailVerified) {
            navigation.navigate('MAIN')
            actionsDice.setOnline(true)
          } else {
            navigation.navigate('CONFIRM_SIGN_UP', {
              email: user.user.email as string
            })
            user.user.sendEmailVerification()
          }
        })
        setLoading(false)
      } else {
        setLoading(false)
      }
    } catch (err) {
      captureException(err)
      setLoading(false)
    }
  }

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
      captureException(e)
    }
  }

  useEffect(() => {
    //console.warn('SubscribeStore.subscriptionActive', SubscribeStore.subscriptionActive)
    //auth().signInWithEmailAndPassword(Config.ADMIN, Config.ADMIN_PASSWORD)
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

    setLoading(true)
    key()

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

  const _onPress = () => {
    navigation.navigate('HELLO')
  }

  return (
    <AppContainer iconLeft={null} title={' '} loading={loading}>
      <CenterView>
        <IconLeela />
        <Space height={s(30)} />
        <Txt h0 title={I18n.t('gameMode')} />
        <Space height={s(30)} />
        <Button title={I18n.t('online')} onPress={_onPress} />
        <Space height={10} />
        <Txt h6 title={I18n.t('or')} textStyle={styles.h6} />
        <Space height={15} />
        <Button title={I18n.t('offline')} onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')} />
        <Space height={s(150)} />
        <ModalSubscribe />
      </CenterView>
    </AppContainer>
  )
})

export { WelcomeScreen }
