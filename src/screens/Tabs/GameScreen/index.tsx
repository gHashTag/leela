import React from 'react'
import { observer } from 'mobx-react'
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
  Spin
} from '../../../components'
import { DiceStore, actionsDice, OnlinePlayer, OfflinePlayers } from '../../../store'
import Rate from 'react-native-rate'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useLeftTimeForStep } from '../../../hooks'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_0'
>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  useLeftTimeForStep()

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

  return loadingProf && DiceStore.online ? (
    <Background enableTopInsets>
      <Spin centered />
    </Background>
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
            <Text textStyle={{ textAlign: 'center' }} h="h1" title={`${I18n.t('win')}`} />
            {!DiceStore.rate ? (
              <ButtonElements
                type="solid"
                themeType="classic"
                title={I18n.t('leaveFeedback')}
                onPress={_onPress}
              />
            ) : (
              <Space height={s(38)} />
            )}
          </>
        ) : undefined}
      </Header>
      <Background>
        {!endGame && <Dice />}
        <GameBoard />
      </Background>
    </>
  )
})

export { GameScreen }
