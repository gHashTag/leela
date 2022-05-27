import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { ms, s, vs } from 'react-native-size-matters'
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
  Spin
} from '../../../components'
import { DiceStore, actionsDice, OnlinePlayer, OfflinePlayers } from '../../../store'
import Rate from 'react-native-rate'
import { Button as ClassicBtn } from 'react-native-elements'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StyleSheet, View } from 'react-native'
import { H } from '../../../constants'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_1'
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
  const space = H > 600 ? vs(120) : vs(85)
  return (
    <Background>
      {OnlinePlayer.store.loadingProf && DiceStore.online ? (
        <Spin />
      ) : (
        <>
          <Header
            iconLeft=":information_source:"
            onPress={() => navigation.navigate('RULES_SCREEN')}
            iconRight=":books:"
            onPressRight={() => navigation.navigate('PLANS_SCREEN')}
          >
            {endGame ? (
              <>
                <Space height={s(60)} />
                <ButtonElements
                  title={I18n.t('startOver')}
                  onPress={
                    DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
                  }
                />
                <Space height={s(10)} />
                <Text
                  textStyle={{ textAlign: 'center' }}
                  h="h1"
                  title={`${I18n.t('win')}`}
                />
                {!DiceStore.rate && (
                  <ClassicBtn title={I18n.t('leaveFeedback')} onPress={_onPress} />
                )}
              </>
            ) : (
              <>
                {!OnlinePlayer.store.canGo && DiceStore.online ? (
                  <View style={messContainer}>
                    <Text
                      h="h5"
                      textStyle={{ textAlign: 'center' }}
                      title={`${I18n.t('nextStep')}: ${OnlinePlayer.store.timeText}`}
                    />
                  </View>
                ) : (
                  <View style={messContainer}>
                    <Text
                      h="h5"
                      textStyle={{ textAlign: 'center' }}
                      title={
                        DiceStore.online
                          ? I18n.t('takeStep')
                          : `${I18n.t('playerTurn')} # ${DiceStore.players}`
                      }
                    />
                  </View>
                )}
                <Space height={1} />
                <View style={messContainer}>
                  <Text
                    textStyle={{ textAlign: 'center' }}
                    h="h5"
                    title={DiceStore.message}
                  />
                </View>
                <Dice />
              </>
            )}
          </Header>
          <Space height={space} />
          <GameBoard />
          <Space height={s(0)} />
        </>
      )}
    </Background>
  )
})

const { messContainer } = StyleSheet.create({
  messContainer: {
    flexWrap: 'wrap',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  }
})

export { GameScreen }
