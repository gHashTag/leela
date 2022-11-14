import React, { memo } from 'react'

import {
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ICONS } from './images'

import { useImageAspect } from '../../hooks'

interface BackgroundT {
  status?: 'bg' | 'clean' | '1x1'
  children?: React.ReactNode
  sourceImages?: [string, string] | [string]
  style?: StyleProp<ViewStyle>
  enableBottomInsets?: boolean
  enableTopInsets?: boolean
  paddingTop?: number
}

export const Background = memo(
  ({
    status = 'bg',
    sourceImages,
    children,
    style,
    paddingTop = 0,
    enableBottomInsets,
    enableTopInsets,
  }: BackgroundT) => {
    const images = ICONS.find(x => x.title === status)?.paths || sourceImages || []
    const { bottom, top } = useSafeAreaInsets()

    return (
      <View style={page.container}>
        <View
          style={[
            page.imgContainer,
            style,
            enableBottomInsets && { paddingBottom: bottom },
            enableTopInsets && { paddingTop: top + paddingTop },
          ]}
        >
          {images.map((img, id) => (
            <RenderImagePart
              key={id}
              img={img}
              id={id}
              images={images}
              isUri={!!sourceImages}
            />
          ))}
        </View>
        {children}
      </View>
    )
  },
)

interface RenderImagePartT {
  img: string | any
  id: number
  isUri?: boolean
  images: any[]
}

const RenderImagePart = ({ img, id, isUri }: RenderImagePartT) => {
  const { width: W } = useWindowDimensions()
  const aspect = useImageAspect(img, !isUri)

  const height = W / aspect
  //const isOne = images?.length
  const isTop = id === 0

  return (
    <View style={[page.subImgContainer, !isTop && page.bottomImage]}>
      <Image source={isUri ? { uri: img } : img} style={[page.imgStyle, { height }]} />
    </View>
  )
}

const page = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomImage: {
    justifyContent: 'flex-end',
  },
  imgContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
  imgStyle: {
    width: '100%',
    marginVertical: 10,
  },
  subImgContainer: {
    flex: 1,
  },
})
