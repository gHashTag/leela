import React, { memo } from 'react'
import { SafeAreaView, StyleSheet, StyleProp, ImageStyle, ImageBackground, View } from 'react-native'
import { ICONS } from './images'
import { W, H } from '../../constants'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  img: {
    width: W,
    height: H + 70
  }
})

interface BackgroundT {
  status?: string
  imageStyle?: StyleProp<ImageStyle>
  children?: React.ReactNode
  sourceImg?: string
}

const Background = memo(({ status = 'bg', imageStyle, sourceImg, children }: BackgroundT) => {
  const { container, img } = styles
  const source = () => {
    const res = ICONS.find(x => x.title === status)
    return res ? res.path : ''
  }
  return (
    <SafeAreaView style={container}>
      <ImageBackground
        resizeMode={'contain'}
        source={!!sourceImg ? { uri: sourceImg } : source()}
        style={[img, imageStyle]}
      >
        {children}
      </ImageBackground>
    </SafeAreaView>
  )
})

export { Background }
