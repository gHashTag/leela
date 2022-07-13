import React, { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { I18n } from '../../../utils'
import { RootStackParamList, RootTabParamList } from '../../../types'
import {
  Background,
  Dice,
  GameBoard,
  Header,
  Space,
  Text,
  ButtonElements,
  Spin,
  HeaderMessage
} from '../../../components'
import { DiceStore, actionsDice, OnlinePlayer, OfflinePlayers } from '../../../store'
import Rate from 'react-native-rate'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StyleSheet, View } from 'react-native'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_0'
>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = Date.now()
      OnlinePlayer.store.timeText = OnlinePlayer.getLeftTime(OnlinePlayer.store.stepTime)
      if (
        currentDate - OnlinePlayer.store.stepTime >= 86400000 &&
        OnlinePlayer.store.stepTime !== 0
      ) {
        OnlinePlayer.store.canGo = true
      } else {
        OnlinePlayer.store.canGo = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const _onPress = () => {
    const options = {
      AppleAppID: '1296604457',
      GooglePackageName: 'com.leelagame',
      OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
      preferInApp: false,
      openAppStoreIfInAppFails: true
    }
    Rate.rate(options, success => actionsDice.setRate(success))
  }
  const endGame = DiceStore.online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1
  const { loadingProf } = OnlinePlayer.store

  return (
    <Background>
      {loadingProf && DiceStore.online ? (
        <Spin centered />
      ) : (
        <>
          <Header
            iconLeft=":information_source:"
            onPress={() => navigation.navigate('RULES_SCREEN')}
            iconRight=":books:"
            displayStatus
            textAlign="center"
            onPressRight={() => navigation.navigate('PLANS_SCREEN')}
          >
            {endGame ? (
              <>
                <ButtonElements
                  title={I18n.t('startOver')}
                  onPress={
                    DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
                  }
                />
                <Space height={vs(3)} />
                <Text
                  textStyle={{ textAlign: 'center' }}
                  h="h1"
                  title={`${I18n.t('win')}`}
                />
                {!DiceStore.rate && (
                  <ButtonElements
                    type="solid"
                    themeType="classic"
                    title={I18n.t('leaveFeedback')}
                    onPress={_onPress}
                  />
                )}
              </>
            ) : undefined}
          </Header>
          {!endGame && <Dice />}
          <GameBoard />
        </>
      )}
    </Background>
  )
})

export { GameScreen }
