import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Keychain from 'react-native-keychain'
import { s } from 'react-native-size-matters'
import { v4 as uuidv4 } from 'uuid'
import messaging from '@react-native-firebase/messaging'
import auth from '@react-native-firebase/auth'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScaledSheet } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import {
  AppContainer,
  // ModalSubscribe,
  Space,
  Button,
  Text,
  CenterView,
  IconLeela,
  Loading
} from '../../components'
import { actionsSubscribe, actionsDice } from '../../store'
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
  const [loading, setLoading] = useState<boolean>(true)

  const key = async (): Promise<void> => {
    try {
      const credentials = await Keychain.getInternetCredentials('auth')
      if (credentials) {
        const { username, password } = credentials
        await auth()
          .signInWithEmailAndPassword(username, password)
          .then(user => {
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
      }
      setLoading(false)
    } catch (err) {
      captureException(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    //auth().signInWithEmailAndPassword(Config.ADMIN, Config.ADMIN_PASSWORD)
    actionsSubscribe.purchaserInfo()
    const checkGame = async () => {
      const init = await AsyncStorage.getItem('@init')
      if (init === 'true') {
        navigation.navigate('MAIN')
      }
    }

    checkGame()
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
  }, [])

  const _onPress = () => {
    navigation.navigate('HELLO')
  }

  return (
    <AppContainer iconLeft={null}>
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={s(30)} />
          <Text h={'h1'} title={I18n.t('gameMode')} />
          <Space height={s(30)} />
          <Button title={I18n.t('online')} onPress={_onPress} />
          <Space height={10} />
          <Text h={'h5'} title={I18n.t('or')} textStyle={styles.h6} />
          <Space height={15} />
          <Button
            title={I18n.t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          />
          <Space height={s(140)} />
          {/* <ModalSubscribe /> */}
        </CenterView>
      )}
    </AppContainer>
  )
})

export { WelcomeScreen }
