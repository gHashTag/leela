import React from 'react'

import { StyleSheet, View } from 'react-native'

import { EmojiText, Space, Text } from '../'
import { I18n } from '../../utils'

const getIconName = (status: string) => {
  switch (status) {
    case 'snake':
      return ':snake:'
    case 'arrow':
      return ':bow_and_arrow:'
    case 'cube':
      return ':game_die:'
    case 'start':
      return ':sun_with_face:'
    case 'liberation':
      return ':game_die:'
    default:
      return 'null'
  }
}

interface StepsT {
  item: {
    createDate: number
    plan: number
    count: number
    status: string
  }
  index: number
}

export const HistoryStep = ({ item }: StepsT) => {
  const { plan, count, status } = item
  return (
    <View style={container}>
      <Space width={0} />
      {status === 'cube' && (
        <>
          <EmojiText name={getIconName('cube')} />
          <Space width={5} />
          <Text h={'h5'} title={`${count} `} />
        </>
      )}
      {status !== 'cube' && (
        <>
          <EmojiText name={getIconName('cube')} />
          <Space width={5} />
          <Text h={'h5'} title={`${count} => `} />
          <EmojiText name={getIconName(status)} />
        </>
      )}
      <Text h={'h5'} title={`=> ${I18n.t('plan')} ${plan}`} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 10,
  },
})

const { container } = styles
