import React, { memo } from 'react'
import { StyleSheet, Image, View, useWindowDimensions } from 'react-native'
import FitImage from 'react-native-fit-image'
import { s, vs } from 'react-native-size-matters'
import { useImageAspect } from '../../hooks'

interface ImgT {
  maxHeight?: number
  uri: string
  widthCoefficient?: number
}

export const Img = memo<ImgT>(({ maxHeight = 370, uri = '', widthCoefficient = 1 }) => {
  const aspect = useImageAspect(uri)
  const { width: W } = useWindowDimensions()

  let width = W * widthCoefficient
  const height = width / aspect

  if (maxHeight && height > maxHeight) {
    width = maxHeight * aspect
  }

  return (
    <View style={[mainBlock, { maxHeight }]}>
      <Image
        style={[
          img,
          {
            width,
            height,
            maxHeight
          }
        ]}
        resizeMode="contain"
        source={{ uri }}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  img: {
    borderRadius: s(12),
    overflow: 'hidden'
  },
  mainBlock: {
    width: '100%',
    alignItems: 'center'
  }
})

const { img, mainBlock } = styles
