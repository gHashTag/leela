import React, { memo } from 'react'
import { StyleSheet, StyleProp, ImageStyle, ImageBackground, View } from 'react-native'
import { ICONS } from './images'
import { W, H } from '../../constants'
import { SafeAreaView } from 'react-native-safe-area-context'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  img: {
    width: W,
    height: H + 70,
    position: 'absolute'
  }
})

interface BackgroundT {
  status?: 'bg' | 'clean' | '1x1'
  imageStyle?: StyleProp<ImageStyle>
  children?: React.ReactNode
  sourceImg?: string
}

const Background = memo(
  ({ status = 'bg', imageStyle, sourceImg, children }: BackgroundT) => {
    const { container, img } = styles
    const source = () => {
      const res = ICONS.find(x => x.title === status)
      return res ? res.path : ''
    }
    return (
      <View style={container}>
        <ImageBackground
          resizeMode={'contain'}
          source={!!sourceImg ? { uri: sourceImg } : source()}
          style={[img, imageStyle]}
        />
        {children}
      </View>
    )
  }
)

export { Background }
