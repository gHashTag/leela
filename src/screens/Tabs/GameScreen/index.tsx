import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import firestore from '@react-native-firebase/firestore'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'

import { useTranslation } from 'react-i18next'

import { s, vs } from 'react-native-size-matters'
import { captureException, gray, onLeaveFeedback } from '../../../constants'
import { useRevenueCat } from '../../../providers/RevenueCatProvider'
import { getUid } from '../../../screens/helper'

import {
  Background,
  ButtonSimple,
  ButtonWithIcon,
  Dice,
  GameBoard,
  Header,
  Space,
  Text
} from '../../../components'
import { useLeftTimeForStep } from '../../../hooks'
import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  PostStore,
  SubscribeStore,
  actionsDice
} from '../../../store'
import { RootStackParamList, RootTabParamList } from '../../../types/types'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_0'
>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  const { user } = useRevenueCat()
  useLeftTimeForStep()

  const limit = 15
  useEffect(() => {
    const uid = getUid()

    const query = uid
      ? firestore()
          .collection('Posts')
          .where('ownerId', '==', uid)
          .orderBy('createTime', 'desc')
          .limit(limit)
      : firestore()
          .collection('Posts')
          .orderBy('createTime', 'desc')
          .limit(limit)

    const unsubscribe = query.onSnapshot(PostStore.fetchOwnPosts, (error) =>
      captureException(error, 'fetchOwnPosts')
    )

    return () => {
      unsubscribe()
    }
  }, [limit])

  const { t } = useTranslation()

  const onPressRate = () => {
    onLeaveFeedback((success) => actionsDice.setRate(success))
  }

  const endGame = DiceStore.online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1

  const postsCount = PostStore.store.ownPosts.length
  const isBlockGame = SubscribeStore.isBlockGame

  const isMoreThree = postsCount >= 3
  const _onPress = () => navigation.navigate('SUBSCRIPTION_SCREEN')
  const online = DiceStore.online

  return (
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
              viewStyle={styles.centerButton}
              h="h5"
              title={t('actions.startOver')}
              onPress={
                DiceStore.online
                  ? OnlinePlayer.resetGame
                  : OfflinePlayers.resetGame
              }
            />
            <Space height={vs(2)} />
            <Text textStyle={styles.centerText} h="h1" title={`${t('win')}`} />
            {DiceStore.rate && isMoreThree ? (
              <ButtonWithIcon
                viewStyle={styles.centerButton}
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

      {!user.pro && isBlockGame && online && (
        <ButtonSimple onPress={_onPress} h="h3" title={t('buy')} />
      )}

      {/* DEBUG
      <Text h="h3" title={`user.pro: ${user.pro}`} />
      <Text h="h3" title={`isBlockGame: ${isBlockGame}`} /> */}

      <GameBoard />
    </Background>
  )
})

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center'
  },
  centerButton: {
    alignSelf: 'center'
  },
  textStyle: { color: gray, fontSize: 19 }
})

export { GameScreen }
