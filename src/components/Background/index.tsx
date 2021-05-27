import React, { memo } from 'react'
import { SafeAreaView, StyleSheet, StyleProp, ImageStyle, ImageBackground } from 'react-native'
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
}

const Background = memo(({ status = 'bg', imageStyle, children }: BackgroundT) => {
  const { container, img } = styles
  const source = () => ICONS.filter(x => x.title === status)[0].path
  return (
    <SafeAreaView style={container}>
      <ImageBackground resizeMode={'contain'} source={source()} style={[img, imageStyle]}>
        {children}
      </ImageBackground>
    </SafeAreaView>
  )
})

export { Background }
