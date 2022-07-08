import React from 'react'
import {
  StyleProp,
  TouchableOpacity,
  ViewStyle,
  useColorScheme,
  StyleSheet
} from 'react-native'
import { s } from 'react-native-size-matters'
import Icon from 'react-native-vector-icons/FontAwesome'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { dimGray, gray, lightGray, white } from '../../../constants'
import { Space } from '../../Space'
import { Text } from '../../'

interface ButtonVectorIconI {
  name: string
  size?: number
  color?: string
  onPress?: () => void
  viewStyle?: StyleProp<ViewStyle>
  count?: number
  ionicons?: boolean
}

export function ButtonVectorIcon({
  name,
  onPress,
  size = s(10),
  color,
  viewStyle,
  count,
  ionicons
}: ButtonVectorIconI) {
  const scheme = useColorScheme()
  const colorTheme = scheme === 'dark' ? dimGray : gray
  return (
    <TouchableOpacity style={viewStyle} onPress={onPress} activeOpacity={0.7}>
      {ionicons ? (
        <Ionicons name={name} size={size + s(2)} color={color ? color : colorTheme} />
      ) : (
        <Icon name={name} size={size} color={color ? color : colorTheme} />
      )}
      {count !== undefined && (
        <>
          <Space width={s(5)} />
          <Text
            title={count.toString()}
            h={'h5'}
            textStyle={{ fontSize: size, color: colorTheme }}
          />
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  }
})
