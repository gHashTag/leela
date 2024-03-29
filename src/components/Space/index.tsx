import React, { memo } from 'react'

import { View } from 'react-native'

interface SpaceT {
  height?: number | string
  width?: number | string
}

const Space = memo<SpaceT>(({ height, width }) => (
  <View
    testID="space-component"
    style={{ height: Number(height) || 0, width: Number(width) || 0 }}
  />
))

export { Space }
