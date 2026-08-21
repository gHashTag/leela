import React, { memo, useMemo } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { EmojiText, Space, Text } from '../../components'
import {
  black,
  brightTurquoise,
  dimGray,
  orange,
  primary,
  red
} from '../../constants'
import { OnlinePlayer } from '../../store'

const getIconName = (status: string) => {
  switch (status) {
    case 'snake':
      return ':snake:'
    case 'arrow':
      return ':bow_and_arrow:'
    case 'start':
      return ':sun_with_face:'
    case 'liberation':
      return ':sparkles:'
    default:
      return ':game_die:'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'snake':
      return red
    case 'arrow':
      return brightTurquoise
    case 'liberation':
      return primary
    case 'start':
      return orange
    default:
      return dimGray
  }
}

export const LastMoveReplay = memo(() => {
  const { t } = useTranslation()

  const history = OnlinePlayer.store.history
  const lastMove = history && history.length > 0 ? history[0] : null

  const content = useMemo(() => {
    if (!lastMove) return null

    const { count, plan, status, createDate } = lastMove
    const previous = history.length > 1 ? history[1].plan : plan - count
    const planFrom = previous >= 1 ? previous : 1
    const statusLabel = t(`lastMoveReplay.status.${status}`, {
      defaultValue: t(status === 'cube' ? 'cube' : status)
    })

    return (
      <View style={styles.row}>
        <EmojiText name={getIconName(status)} fontSize={s(13)} />
        <Space width={s(6)} />
        <Text
          h="h11"
          textStyle={[styles.moveText, { color: getStatusColor(status) }]}
          title={t('lastMoveReplay.move', {
            from: planFrom,
            to: plan,
            count,
            status: statusLabel
          })}
        />
        <Space width={s(8)} />
        <Text
          h="h12"
          textStyle={styles.dateText}
          title={new Date(createDate).toLocaleDateString()}
        />
      </View>
    )
  }, [history, lastMove, t])

  if (!lastMove) return null

  return (
    <View style={styles.container}>
      <Text
        h="h11"
        textStyle={styles.label}
        title={t('lastMoveReplay.title')}
      />
      <Space height={vs(4)} />
      {content}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    borderRadius: s(10),
    backgroundColor: 'rgba(30, 228, 236, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(30, 228, 236, 0.35)'
  },
  label: {
    color: dimGray,
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  moveText: {
    fontWeight: '600'
  },
  dateText: {
    color: black,
    opacity: 0.55
  }
})
