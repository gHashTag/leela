import React from 'react'

import { observer } from 'mobx-react'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { DiceStore } from '../../store'
import { Space } from '../Space'
import { Text } from '../TextComponents'

export const HeaderMessage = observer(() => {
  return (
    <>
      {DiceStore.topMessage !== ' ' && DiceStore.topMessage && (
        <View style={messContainer}>
          <Text numberOfLines={1} h="h5" title={DiceStore.topMessage} />
        </View>
      )}
      <Space height={s(1)} />
      {DiceStore.message !== ' ' && DiceStore.message && (
        <View style={messContainer}>
          <Text numberOfLines={1} h="h5" title={DiceStore.message} />
        </View>
      )}
    </>
  )
})
const styles = StyleSheet.create({
  messContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
  },
})

const { messContainer } = styles
