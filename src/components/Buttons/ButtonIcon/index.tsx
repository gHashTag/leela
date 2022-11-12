import React, { memo } from 'react'

import { Image, TouchableOpacity } from 'react-native'

import { ICONS } from './images'

interface ButtonIconT {
  type: 'hamburger' | 'plus' | 'clock' | 'power' | 'power-disable'
  width: number
  height: number
  onPress?: () => void
}

const ButtonIcon = memo<ButtonIconT>(({ type, width, height, onPress }) => {
  const source = () => ICONS[type]
  return (
    <TouchableOpacity onPress={onPress}>
      <Image source={source()} style={{ width, height }} />
    </TouchableOpacity>
  )
})

export { ButtonIcon }
