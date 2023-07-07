import React, { memo } from 'react'

import { Image } from 'react-native'

import { ICONS } from './images'

import { Pressable } from '../../Pressable'

interface ButtonIconT {
  type: 'hamburger' | 'plus' | 'clock' | 'power' | 'power-disable'
  width: number
  height: number
  onPress?: () => void
}

const ButtonIcon = memo<ButtonIconT>(({ type, width, height, onPress }) => {
  const source = () => ICONS[type]
  return (
    <Pressable onPress={onPress}>
      <Image source={source()} style={{ width, height }} />
    </Pressable>
  )
})

export { ButtonIcon }
