import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import {
  Background,
  Dice,
  GameBoard,
  Header,
  Space,
  Text,
  ButtonElements,
  Spin
} from '../../components'
import { DiceStore, actionsDice, OnlinePlayer, OfflinePlayers } from '../../store'
import Rate from 'react-native-rate'
import { Button as ClassicBtn } from 'react-native-elements'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  const [leftTime, setLeftTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = Date.now()
      setLeftTime(currentDate - OnlinePlayer.store.stepTime)
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

  useEffect(() => {
    const timeMood = () => {
      if (!(leftTime >= 86400000)) {
        if (leftTime === 0) {
          return
        }
        const time = 86400000 - leftTime
        switch (true) {
          case leftTime > 86340000:
            OnlinePlayer.store.timeText = `${(time / 1000).toFixed(0)} sec.`
          case leftTime > 82800000:
            OnlinePlayer.store.timeText = `${Math.ceil(time / 60 / 1000).toFixed(0)} min.`
          case leftTime <= 82800000:
            OnlinePlayer.store.timeText = `${Math.floor(time / 60 / 60 / 1000).toFixed(
              0
            )} h.`
        }
      } else {
        OnlinePlayer.store.timeText = '0'
      }
    }
    timeMood()
  }, [leftTime])

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
            <>
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
                    <Text h="h5" title={`nextStep: ${OnlinePlayer.store.timeText}`} />
                  ) : (
                    <Text
                      h="h5"
                      textStyle={{ textAlign: 'center' }}
                      title={
                        DiceStore.online
                          ? 'Take a step'
                          : `${I18n.t('playerTurn')} # ${DiceStore.players}`
                      }
                    />
                  )}
                  <Space height={1} />
                  <Text
                    textStyle={{ textAlign: 'center' }}
                    h="h5"
                    title={DiceStore.message}
                  />
                  <Dice />
                </>
              )}
            </>
          </Header>
          <Space height={ms(85, 0.1)} />
          <GameBoard />
          <Space height={s(0)} />
        </>
      )}
    </Background>
  )
})

export { GameScreen }
