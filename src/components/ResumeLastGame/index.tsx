import React, { memo } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'
import { observer } from 'mobx-react'

import { Space, Text } from '../../components'
import { primary } from '../../constants'
import { DiceStore, OnlinePlayer } from '../../store'

type ResumeLastGameT = {
  onResume: () => void
}

export const ResumeLastGame = observer(({ onResume }: ResumeLastGameT) => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const online = DiceStore.online
  const hasOfflineGame =
    !online && DiceStore.startGame && DiceStore.finishArr.includes(true)
  const hasOnlineGame =
    online && OnlinePlayer.store.start && !OnlinePlayer.store.finish

  if (!hasOfflineGame && !hasOnlineGame) {
    return null
  }

  const modeLabel = online
    ? t('resumeLastGame.online')
    : t('resumeLastGame.offline')
  const playerCount = DiceStore.multi || DiceStore.players || 1

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onResume}
      style={[styles.container, isDark && styles.containerDark]}
      testID="resume-last-game"
      accessibilityRole="button"
      accessibilityLabel={t('resumeLastGame.accessibilityLabel')}
      accessibilityHint={t('resumeLastGame.hint')}
    >
      <View style={styles.row}>
        <Text h="h11" title="🎲" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('resumeLastGame.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(4)} />
      <Text h="h8" title={modeLabel} oneColor="#FFFFFF" />
      {!online && (
        <>
          <Space height={vs(2)} />
          <Text
            h="h10"
            title={`${playerCount} ${
              playerCount === 1
                ? t('resumeLastGame.playerSingular')
                : t('resumeLastGame.playerPlural')
            }`}
            oneColor="#E0E0E0"
          />
        </>
      )}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(80, 227, 194, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.5)'
  },
  containerDark: {
    backgroundColor: 'rgba(80, 227, 194, 0.28)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  }
})
