import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { s } from 'react-native-size-matters'
import { CenterView } from '../CenterView'

export function Fallback() {
  return (
    <CenterView>
      <Image source={require('../../../assets/icons/1080.png')} style={img} />
    </CenterView>
  )
}

const { img } = StyleSheet.create({
  img: {
    width: s(160),
    height: s(160)
  }
})
