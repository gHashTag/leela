import React, { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import firestore from '@react-native-firebase/firestore'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'

import { s, vs } from 'react-native-size-matters'
import {
  captureException,
  gray,
  maybeRequestReview,
  onLeaveFeedback,
  recordPositiveEvent
} from '../../../constants'
import { getUid } from '../../../screens/helper'
import { subscribeTracked } from '../../../utils/listenerRegistry'

import {
  Background,
  BoardLegend,
  ButtonLink,
  ButtonSimple,
  ButtonWithIcon,
  Dice,
  GameBoard,
  GameTooltip,
  Header,
  IntentionPrompt,
  RollResultAnnouncement,
  Space,
  Text,
  TurnIndicator,
  WinCelebration
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
import { useRevenueCat } from '../../../providers/RevenueCatProvider'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_0'
>

type GameScreenT = {
  navigation: navigation
}

const RequestReviewOnWin = observer(() => {
  const prevEndGame = useRef(false)
  const endGame = DiceStore.online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1

  useEffect(() => {
    if (!prevEndGame.current && endGame) {
      recordPositiveEvent().then(() => maybeRequestReview())
    }
    prevEndGame.current = endGame
  }, [endGame])

  return null
})

const GameScreen = observer(({ navigation }: GameScreenT) => {
  const [showLegend, setShowLegend] = React.useState(false)
  const { user } = useRevenueCat()
  useLeftTimeForStep()

  const limit = 15

  useEffect(() => {
    // The feed is an online feature. This screen is one of the tabs
    // registered unconditionally in Navigation.tsx (unlike PostScreen, which
    // is only added when `DiceStore.online`), and Material Top Tabs mounts
    // registered screens rather than only the focused one — so this effect
    // ran on every launch, offline or not, and called `firestore()` before
    // anything checked whether Firebase was even configured. Guarded the same
    // way `useGameAndProfileIsOnline` guards its own subscriptions.
    if (!DiceStore.online) return

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

    const dispose = subscribeTracked('GameScreen', () =>
      query.onSnapshot(PostStore.fetchOwnPosts, (error) =>
        captureException(error, 'fetchOwnPosts')
      )
    )

    return () => {
      dispose()
    }
  }, [limit])

  const { t } = useTranslation()
  const online = DiceStore.online
  const onPressRate = () => {
    onLeaveFeedback((success) => actionsDice.setRate(success))
  }

  const endGame = online
    ? OnlinePlayer.store.finish
    : DiceStore.finishArr.indexOf(true) === -1

  // Before the first six the player is not on the board yet, so the rule they
  // need is how to get on it; after that it is the report that gates the next
  // roll.
  const hasStarted = online ? OnlinePlayer.store.start : DiceStore.startGame

  const isBlockGame = SubscribeStore.isBlockGame

  const _onPress = () => navigation.navigate('SUBSCRIPTION_SCREEN')

  const history = online
    ? OnlinePlayer.store.history
    : OfflinePlayers.store.histories[DiceStore.players - 1]
  const lastMove = history && history.length > 0 ? history[0] : null
  const moveTip: import('../../../components/GameTooltip').GameTipId | null =
    lastMove && (lastMove.status === 'arrow' || lastMove.status === 'snake')
      ? lastMove.status
      : null
  const activeTip = moveTip || (hasStarted ? 'report' : 'six')

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
                online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
              }
            />
            <Space height={vs(2)} />
            <Text textStyle={styles.centerText} h="h1" title={`${t('win')}`} />
            {DiceStore.rate ? (
              <ButtonWithIcon
                viewStyle={styles.centerButton}
                h="h5"
                title={t('actions.leaveFeedback')}
                onPress={onPressRate}
              />
            ) : (
              <Space height={s(38)} />
            )}
            <RequestReviewOnWin />
          </>
        )}
      </Header>
      {/* The rule that matters right now, above the board. */}
      <GameTooltip tip={activeTip} />
      {/* Board and dice sit on the floor of the screen, in that order, with
          air between them. Everything that reports on play - today's summary,
          the streak cards, the journal - lives in the profile tab; this screen
          is the game. */}
      {/* Scrolls when the board does not fit. With a plain flex-end view the
          board overflowed past the top edge and drew straight over the tip
          card above it - the numbers landed on the tip's own text. */}
      <ScrollView
        style={styles.playScroll}
        contentContainerStyle={styles.playArea}
        showsVerticalScrollIndicator={false}
      >
        <TurnIndicator />
        <GameBoard />
        {!endGame && (
          <View style={styles.diceSlot}>
            <Dice disabled={isBlockGame} />
            <RollResultAnnouncement />
            <ButtonLink
              title={t('boardLegend.open')}
              onPress={() => setShowLegend(true)}
              viewStyle={styles.legendLink}
              testID="board-legend-link"
            />
          </View>
        )}
      </ScrollView>

      {isBlockGame && (
        <ButtonSimple onPress={_onPress} h="h3" title={t('buy')} />
      )}

      {/* FirstRollCoachMark removed: it said the same thing as the tip card
          above the board ("a six places your piece"), as a modal on top of it,
          so the screen carried two coaches arguing over the same rule. */}

      <IntentionPrompt />
      <WinCelebration />
      <BoardLegend visible={showLegend} onClose={() => setShowLegend(false)} />
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
  textStyle: { color: gray, fontSize: 19 },
  legendButton: {
    alignSelf: 'center',
    marginVertical: vs(6)
  },
  // flex-end pins the pair to the bottom, so board and dice sit on the floor
  // of the screen instead of floating with dead space beneath them.
  playScroll: {
    flex: 1
  },
  playArea: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    // Clears the tab bar. Without it the dice sat under it and its bottom row
    // of pips was cut off with nothing left to scroll to.
    paddingBottom: vs(28)
  },
  diceSlot: {
    marginTop: vs(16),
    marginBottom: vs(4)
  },
  legendLink: {
    alignSelf: 'center',
    marginTop: vs(8)
  }
})

export { GameScreen }
