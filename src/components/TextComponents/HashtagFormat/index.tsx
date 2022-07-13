import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Text, hT, TxtT, SelectableIOS } from '../'
import { fuchsia } from '../../../constants'

interface HashTagT extends TxtT {
  hashTagColor?: string
}

export function HashtagFormat({ hashTagColor = fuchsia, title, ...textProps }: HashTagT) {
  return (
    <View style={container}>
      {title
        .split(/([#@](?:[^\x00-\x7F]|\w)+)/g)
        .filter(Boolean)
        .map((el, id) => {
          if (el.includes('#') || el.includes('@')) {
            if (Platform.OS === 'ios' && textProps.selectable) {
              return (
                <SelectableIOS
                  h={textProps.h}
                  key={id}
                  title={el}
                  oneColor={hashTagColor}
                />
              )
            }

            return <Text key={id} {...textProps} title={el} oneColor={hashTagColor} />
          } else {
            if (Platform.OS === 'ios' && textProps.selectable) {
              return <SelectableIOS h={textProps.h} key={id} title={el} />
            }
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
