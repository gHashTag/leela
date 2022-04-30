import React, { memo } from 'react'
import { View } from 'react-native'

interface SpaceT {
  height?: number | string
  width?: number | string
}

const Space = memo<SpaceT>(({ height, width }) => (
  <View style={{ height: height || 0, width: width || 0 }} />
))

export { Space }
