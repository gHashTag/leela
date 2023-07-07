import React from 'react'

import { Image } from 'react-native'
import { s } from 'react-native-size-matters'

import { CenterView } from '../CenterView'

export function Fallback() {
  return (
    <CenterView>
      <Image
        source={require('../../../assets/icons/1080.png')}
        style={{
          width: s(160),
          height: s(160),
        }}
      />
    </CenterView>
  )
}
