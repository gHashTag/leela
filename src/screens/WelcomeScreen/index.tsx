import React, { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Keychain from 'react-native-keychain'
import { s, vs } from 'react-native-size-matters'
import auth from '@react-native-firebase/auth'
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
import { actionsDice } from '../../store'
import { captureException, OpenPlanReportModal } from '../../constants'
import { useNetInfo } from '@react-native-community/netinfo'
import { useFocusEffect } from '@react-navigation/native'
import { getProfile, onSignIn } from '../helper'

type navigation = NativeStackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const styles = ScaledSheet.create({
  h6: { alignSelf: 'center' }
})

const WelcomeScreen = observer(({ navigation }: SelectPlayersScreenT) => {
  const [loading, setLoading] = useState<boolean>(true)
  const { isConnected } = useNetInfo()
  const key = async (): Promise<void> => {
    try {
      const credentials = await Keychain.getInternetCredentials('auth')
      if (credentials && isConnected) {
        const { username, password } = credentials
        await auth()
          .signInWithEmailAndPassword(username, password)
          .then(async user => {
            await onSignIn(user.user)
          })
      } else if (isConnected !== null) {
        return Promise.reject()
      }
      isConnected !== null && setLoading(false)
    } catch (err) {
      captureException(err)
      isConnected !== null && setLoading(false)
      return Promise.reject()
    }
  }

  const checkGame = async () => {
    const init = await AsyncStorage.getItem('@init')
    if (init === 'true') {
      navigation.navigate('MAIN')
    } else {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      key().catch(checkGame)
    }, [isConnected])
  )

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
          <Space height={vs(10)} />
          <Text h={'h5'} title={I18n.t('or')} textStyle={styles.h6} />
          <Space height={vs(15)} />
          <Button
            title={I18n.t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          />
          <Space height={vs(120)} />
          {/* <ModalSubscribe /> */}
        </CenterView>
      )}
    </AppContainer>
  )
})

export { WelcomeScreen }
