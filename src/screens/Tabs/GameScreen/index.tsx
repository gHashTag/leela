import React from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import Rate from 'react-native-rate'
import { s, vs } from 'react-native-size-matters'
import { trueBlue } from 'src/constants'

import {
  Background,
  ButtonWithIcon,
  Dice,
  GameBoard,
  Header,
  Space,
  Spin,
  Text,
} from '../../../components'
import { useLeftTimeForStep } from '../../../hooks'
import { DiceStore, OfflinePlayers, OnlinePlayer, actionsDice } from '../../../store'
import { RootStackParamList, RootTabParamList } from '../../../types'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_0'
>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  useLeftTimeForStep()
  const { t } = useTranslation()

  const onLeaveFeedback = () => {
    const options = {
      AppleAppID: '1296604457',
      GooglePackageName: 'com.leelagame',
      OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
      preferInApp: false,
      openAppStoreIfInAppFails: true,
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
      <Background enableTopInsets paddingTop={vs(50)}>
        <Header
          iconLeft=":information_source:"
          onPress={() => navigation.navigate('RULES_SCREEN')}
          iconRight=":books:"
          displayStatus
          textAlign="center"
          onPressRight={() => navigation.navigate('PLANS_SCREEN')}
        >
          {endGame && (
            <>
              <ButtonWithIcon
                viewStyle={page.centerButton}
                h="h5"
                title={t('actions.startOver')}
                onPress={
                  DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
                }
              />
              <Space height={vs(2)} />
              <Text textStyle={page.centerText} h="h1" title={`${t('win')}`} />
              {!DiceStore.rate ? (
                <ButtonWithIcon
                  viewStyle={page.centerButton}
                  h="h5"
                  color={trueBlue}
                  title={t('actions.leaveFeedback')}
                  onPress={onLeaveFeedback}
                />
              ) : (
                <Space height={s(38)} />
              )}
            </>
          )}
        </Header>
        {!endGame && <Dice />}
        <GameBoard />
      </Background>
    </>
  )
})

const page = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  centerButton: {
    alignSelf: 'center',
  },
})

export { GameScreen }
