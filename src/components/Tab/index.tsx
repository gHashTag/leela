// @flow
import React, { memo } from 'react'
import { Image, Platform, ImageStyle, StyleProp } from 'react-native'
import { ifIphoneX } from 'react-native-iphone-x-helper'
import { ICONS } from './images'
import { ScaledSheet, s, ms } from 'react-native-size-matters'

const styles = ScaledSheet.create({
  img: {
    ...ifIphoneX(
      {
        width: s(70),
        height: s(40),
        marginRight: s(10)
      },
      {
        width: Platform.OS === 'ios' ? ms(35, 0.7) : ms(35, 0.7),
        height: Platform.OS === 'ios' ? ms(35, 0.7) : ms(35, 0.7)
      }
    )
  }
})

interface TabT {
  title: string
  imageStyle?: StyleProp<ImageStyle>
}

const Tab = memo<TabT>(({ title, imageStyle }) => {
  const { img } = styles

  const source = () => ICONS.filter(x => x.title === title)[0].path

  return <Image source={source()} style={[img, imageStyle]} />
})

export { Tab }
