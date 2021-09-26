import React, { memo } from 'react'
import { Image, StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  img: {
    width: 120,
    height: 120
  }
})

const IconLeela = memo(() => {
  return <Image source={require('../../../assets/icons/120.png')} style={styles.img} />
})

export { IconLeela }
