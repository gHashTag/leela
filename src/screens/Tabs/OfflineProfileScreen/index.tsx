import React, { useCallback, useEffect, useState } from 'react'

import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react-lite'
import { useTranslation } from 'react-i18next'
import { SectionList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  AppContainer,
  BedtimeReminder,
  Button,
  CenterView,
  ConfirmDialog,
  EmptyComments,
  HistoryStep,
  LoadingButton,
  Space,
  Spin,
  Text
} from '../../../components'
import { useHistoryData } from '../../../hooks'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../../store'
import { RootStackParamList, RootTabParamList } from '../../../types/types'
import { triggerHaptic } from '../../../utils/haptics'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_3'
>

type ProfileScreenT = {
  navigation: navigation
}

type PendingAction = 'startOver' | 'signOut' | null

export const OfflineProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const { data: DATA, loading, error } = useHistoryData()
  const { t } = useTranslation()
  const [pending, setPending] = useState<PendingAction>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showFirstWinBanner, setShowFirstWinBanner] = useState(false)

  const hasHistory = Array.isArray(DATA) && DATA.length > 0

  useEffect(() => {
    if (hasHistory) {
      setShowFirstWinBanner(true)
      const timer = setTimeout(() => setShowFirstWinBanner(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [hasHistory])

  const confirmDestructive = useCallback(
    (action: NonNullable<PendingAction>) => {
      triggerHaptic('notificationWarning')
      setPending(action)
    },
    []
  )

  const handleStartOver = useCallback(async () => {
    setPending(null)
    setIsBusy(true)
    try {
      if (DiceStore.online) {
        await OnlinePlayer.resetGame()
      } else {
        await OfflinePlayers.resetGame()
      }
    } catch (err) {
      // Silent failure is acceptable here; the action sheet already closed.
    }
    setIsBusy(false)
  }, [])

  const handleSignOut = useCallback(async () => {
    setPending(null)
    setIsBusy(true)
    try {
      await OnlinePlayer.SignOut()
    } catch (err) {
      // Silent failure is acceptable here; the action sheet already closed.
    }
    setIsBusy(false)
  }, [])

  const confirmTitle =
    pending === 'startOver'
      ? t('actions.startOver')
      : pending === 'signOut'
      ? t('auth.signOut')
      : t('actions.confirm')

  const dialogMessage =
    pending === 'startOver'
      ? t('confirm.resetMessage')
      : pending === 'signOut'
      ? t('confirm.signOutMessage')
      : ''

  const startFirstGame = () => {
    triggerHaptic('impactMedium')
    navigation.navigate('SELECT_PLAYERS_SCREEN')
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <EmptyComments />
      <Space height={vs(16)} />
      <Text
        h="h4"
        title={t('offlineProfile.emptyTitle')}
        textStyle={styles.emptyTitle}
      />
      <Space height={vs(8)} />
      <Text
        h="h6"
        title={t('offlineProfile.emptyMessage')}
        textStyle={styles.emptyMessage}
      />
      <Space height={vs(24)} />
      <Button
        title={t('offlineProfile.playFirstGame')}
        onPress={startFirstGame}
        testID="offline-profile-play-first-game"
      />
    </View>
  )

  const renderHeader = () => (
    <>
      {showFirstWinBanner && (
        <View
          style={styles.banner}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('offlineProfile.firstWinBanner')}
        >
          <Text
            h="h6"
            title={t('offlineProfile.firstWinBanner')}
            textStyle={styles.bannerText}
          />
        </View>
      )}
    </>
  )

  const renderFooter = () => (
    <>
      <BedtimeReminder />
      <Space height={70} />
      <LoadingButton
        title={t('actions.startOver')}
        loading={isBusy && pending === 'startOver'}
        onPress={() => confirmDestructive('startOver')}
        haptic="impactMedium"
      />
      <Space height={20} />
      {DiceStore.online && (
        <>
          <LoadingButton
            title={t('auth.signOut')}
            loading={isBusy && pending === 'signOut'}
            onPress={() => confirmDestructive('signOut')}
            haptic="impactMedium"
          />
          <Space height={20} />
        </>
      )}
      <Space height={100} />
    </>
  )

  return (
    <AppContainer
      iconRight={':books:'}
      iconLeft={':information_source:'}
      title={t('history')}
      textAlign="center"
    >
      <CenterView>
        {OnlinePlayer.store.loadingProf && DiceStore.online ? (
          <Spin centered />
        ) : error ? (
          <CenterView>
            <Text h="h4" title={t('error')} textStyle={styles.errorTitle} />
            <Space height={vs(8)} />
            <Text h="h6" title={error} textStyle={styles.emptyMessage} />
          </CenterView>
        ) : !hasHistory ? (
          <>
            {renderEmpty()}
            {renderFooter()}
          </>
        ) : (
          <SectionList
            style={{ paddingHorizontal: s(10) }}
            ListHeaderComponent={renderHeader()}
            ListFooterComponent={renderFooter()}
            ListEmptyComponent={renderEmpty}
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            stickySectionHeadersEnabled={false}
            sections={DATA}
            renderItem={(props) => <HistoryStep {...props} />}
            keyExtractor={(e, id) => String(id)}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <Text
                  h={'h3'}
                  title={title}
                  textStyle={styles.headerSectionText}
                />
              ) : (
                <Space height={20} />
              )
            }
          />
        )}
      </CenterView>
      <ConfirmDialog
        visible={pending !== null}
        title={
          pending === 'startOver'
            ? t('confirm.resetTitle')
            : t('confirm.signOutTitle')
        }
        message={dialogMessage}
        confirmTitle={confirmTitle}
        cancelTitle={t('actions.cancel')}
        destructive
        onConfirm={pending === 'startOver' ? handleStartOver : handleSignOut}
        onCancel={() => setPending(null)}
      />
    </AppContainer>
  )
})

const styles = StyleSheet.create({
  headerSectionText: {
    padding: 15,
    marginTop: 10
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: s(24)
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  emptyMessage: {
    textAlign: 'center'
  },
  banner: {
    backgroundColor: '#50E3C2',
    borderRadius: s(12),
    paddingVertical: vs(8),
    paddingHorizontal: s(16),
    marginHorizontal: s(16),
    marginTop: vs(10),
    alignItems: 'center'
  },
  bannerText: {
    color: '#1c1c1c',
    fontWeight: 'bold'
  },
  errorTitle: {
    textAlign: 'center',
    fontWeight: 'bold'
  }
})
