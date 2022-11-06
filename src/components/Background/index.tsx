import React, { memo } from 'react'
import {
  StyleSheet,
  StyleProp,
  ImageStyle,
  ImageBackground,
  View,
  Image,
  useWindowDimensions,
  ViewStyle
} from 'react-native'
import { ICONS } from './images'
import { W, H } from '../../constants'
import { useImageAspect } from '../../hooks'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BackgroundT {
  status?: 'bg' | 'clean' | '1x1'
  children?: React.ReactNode
  sourceImages?: [string, string] | [string]
  style?: StyleProp<ViewStyle>
  enableBottomInsets?: boolean
  enableTopInsets?: boolean
}

const Background = memo(
  ({
    status = 'bg',
    sourceImages,
    children,
    style,
    enableBottomInsets,
    enableTopInsets
  }: BackgroundT) => {
    const images = ICONS.find(x => x.title === status)?.paths || sourceImages || []
    const { bottom, top } = useSafeAreaInsets()

    return (
      <View style={container}>
        <View
          style={[
            imgContainer,
            style,
            enableBottomInsets && { paddingBottom: bottom },
            enableTopInsets && { paddingTop: top }
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
  }
)

interface RenderImagePartT {
  img: string | any
  id: number
  isUri?: boolean
  images: any[]
}

const RenderImagePart = ({ img, id, isUri, images }: RenderImagePartT) => {
  const { width: W } = useWindowDimensions()
  const aspect = useImageAspect(img, !isUri)

  const height = W / aspect
  const isOne = images?.length
  const isTop = id === 0

  return (
    <View style={[subImgContainer, !isTop && { justifyContent: 'flex-end' }]}>
      <Image source={isUri ? { uri: img } : img} style={[imgStyle, { height }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  imgContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%'
  },
  imgStyle: {
    width: '100%',

    marginVertical: 10
  },
  subImgContainer: {
    flex: 1
  }
})
const { container, imgContainer, imgStyle, subImgContainer } = styles

export { Background }
