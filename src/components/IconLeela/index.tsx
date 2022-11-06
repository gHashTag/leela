import React, { memo } from 'react'
import { Image, StyleSheet } from 'react-native'
import { s } from 'react-native-size-matters'

const SIZE = 80

const styles = StyleSheet.create({
  img: {
    width: s(SIZE),
    height: s(SIZE)
  }
})

const IconLeela = memo(() => {
  return <Image source={require('./6.png')} style={styles.img} />
})

export { IconLeela }
