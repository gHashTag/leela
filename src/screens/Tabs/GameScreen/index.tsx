import React, { useEffect } from 'react'

import firestore from '@react-native-firebase/firestore'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { captureException, onLeaveFeedback, trueBlue } from 'src/constants'
import { getUid } from 'src/screens/helper'

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
import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  PostStore,
  actionsDice,
} from '../../../store'
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

  const limit = 15
  useEffect(() => {
    const subPosts = firestore()
      .collection('Posts')
      .where('ownerId', '==', getUid())
      .orderBy('createTime', 'desc')
      .limit(limit)
      .onSnapshot(PostStore.fetchOwnPosts, captureException)
    return () => {
      subPosts()
    }
  }, [limit])

  const { t } = useTranslation()

  const onPressRate = () => {
    onLeaveFeedback(success => actionsDice.setRate(success))
  }

  const endGame = DiceStore.online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1
  const { loadingProf } = OnlinePlayer.store

  const postsCount = PostStore.store.ownPosts.length

  const postsBool = postsCount >= 3
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
              {DiceStore.rate && postsBool ? (
                <ButtonWithIcon
                  viewStyle={page.centerButton}
                  h="h5"
                  title={t('actions.leaveFeedback')}
                  onPress={onPressRate}
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
