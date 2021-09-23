import React from 'react'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import { Background, Dice, GameBoard, Header, Space, Txt, ButtonElements } from '../../components'
import {
  DiceStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix,
  actionsDice
} from '../../store'
import { Button } from 'react-native'
import Rate from 'react-native-rate'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  return (
    <Background>
      <Header
        iconLeft=":information_source:"
        onPress={() => navigation.navigate('RULES_SCREEN')}
        iconRight=":books:"
        onPressRight={() => navigation.navigate('PLANS_SCREEN')}
      >
        <>
          {DiceStore.finishArr.indexOf(true) !== -1 ? (
            <>
              <Txt h3 title={`${I18n.t('playerTurn')} # ${DiceStore.players}`} />
              <Space height={1} />
              <Txt h3 title={DiceStore.message} />
              <Dice />
            </>
          ) : (
            <>
              <Space height={s(60)} />
              <ButtonElements
                title={I18n.t('startOver')}
                onPress={() => {
                  actionPlayerOne.resetGame()
                  actionPlayerTwo.resetGame()
                  actionPlayerThree.resetGame()
                  actionPlayerFour.resetGame()
                  actionPlayerFive.resetGame()
                  actionPlayerSix.resetGame()
                  navigation.pop()
                }}
              />
              <Space height={s(10)} />
              <Txt h0 title={`${I18n.t('win')}`} />
              {!DiceStore.rate && (
                <Button
                  title="Оставить отзыв"
                  onPress={() => {
                    const options = {
                      AppleAppID: '1296604457',
                      GooglePackageName: 'com.leelagame',
                      OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
                      preferInApp: false,
                      openAppStoreIfInAppFails: true
                    }
                    Rate.rate(options, success => actionsDice.setRate(success))
                  }}
                />
              )}
            </>
          )}
        </>
      </Header>
      <Space height={ms(85, 0.1)} />

      <GameBoard />
      <Space height={s(0)} />
    </Background>
  )
})

export { GameScreen }
