import React, { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import Config from 'react-native-config'
import { requestTrackingPermission } from 'react-native-tracking-transparency'
import { ms, s } from 'react-native-size-matters'
import { v4 as uuidv4 } from 'uuid'
import firestore from '@react-native-firebase/firestore'
import messaging from '@react-native-firebase/messaging'
import auth from '@react-native-firebase/auth'
import * as Sentry from '@sentry/react-native'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import { getUniqueId } from 'react-native-device-info'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { I18n, lang } from '../../utils'
import { RootStackParamList } from '../../'
import { Background, ButtonsSlector, ModalSubscribe, Space, ButtonElements, Txt, CenterView } from '../../components'
import { actionsDice, actionsSubscribe, SubscribeStore } from '../../store'
import { LocalNotification } from '../../utils/noifications/LocalPushController'

type navigation = StackNavigationProp<RootStackParamList, 'SELECT_PLAYERS_SCREEN'>

type SelectPlayersScreenT = {
  navigation: navigation
}

const WelcomeScreen = observer(({ navigation }: SelectPlayersScreenT) => {

  return (
    <Background>
      <CenterView>
      <Txt h0 title={I18n.t('gameMode')} />
      <Space height={s(30)} />
      <ButtonElements title={I18n.t('online')} onPress={() => navigation.navigate('PLAYRA_SCREEN')} />
      <Space height={s(40)} />
      <ButtonElements title={I18n.t('offline')} onPress={() => navigation.navigate('PLAYRA_SCREEN')} />
      <Space height={s(150)} />
      <ModalSubscribe />
      </CenterView>
    </Background>
  )
})

export { WelcomeScreen }
