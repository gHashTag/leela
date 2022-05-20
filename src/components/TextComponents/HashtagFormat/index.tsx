import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, hT, TxtT } from '../'
import { fuchsia } from '../../../constants'

interface HashTagT extends TxtT {
  hashTagColor?: string
}

export function HashtagFormat({
  hashTagColor = fuchsia,
  title,
  ...textProps
}: HashTagT) {
  return (
    <View style={container}>
      {title
        .split(/([#@](?:[^\x00-\x7F]|\w)+)/g)
        .filter(Boolean)
        .map((el, id) => {
          if (el.includes('#') || el.includes('@')) {
            return (
              <Text
                key={id}
                {...textProps}
                title={el}
                oneColor={hashTagColor}
              />
            )
          } else {
            return <Text key={id} {...textProps} title={el} />
          }
        })}
    </View>
  )
}

const { container } = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  }
})
