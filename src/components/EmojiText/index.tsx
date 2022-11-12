import React, { memo } from 'react'

import { Platform, StyleSheet } from 'react-native'
import Emoji from 'react-native-emoji'
import { s } from 'react-native-size-matters'

const styles = StyleSheet.create({
  emoji: {
    left: Platform.OS === 'ios' ? 1 : 0,
  },
})

interface EmojiTextT {
  name: string
  fontSize?: number
}

const EmojiText = memo<EmojiTextT>(({ name, fontSize = s(15) }) => {
  const { emoji } = styles
  return <Emoji name={name} style={StyleSheet.flatten([emoji, { fontSize }])} />
})

export { EmojiText }
