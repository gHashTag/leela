import React, { memo } from 'react'
import { TouchableOpacity, View, Platform } from 'react-native'
import Emoji from 'react-native-emoji'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScaledSheet, s, ms } from 'react-native-size-matters'
import { W } from '../../constants'
import { Text } from '../Text'

const styles = ScaledSheet.create({
  container: {
    height: ms(40, 0.4),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  leftIconStyle: {
    fontSize: Platform.OS === 'ios' ? '33@ms' : '28@ms',
    width: ms(60, 0.5),
    height: ms(60, 0.5),
    textAlign: 'center',
    top: ms(10, 0.8),
    left: s(5)
  },
  rightIconStyle: {
    fontSize: Platform.OS === 'ios' ? '40@ms' : '32@ms',
    width: ms(60, 0.5),
    height: ms(60, 0.5),
    textAlign: 'center',
    top: ms(10, 0.8),
    right: s(5)
  },
  rightViewStyle: {
    width: ms(20, 0.5)
  },
  titleStyle: {
    flex: 1,
    fontSize: 28,
    left: 5
  },
  childrenStyle: {
    top: ms(5, 2.8)
  }
})

interface HeaderT {
  title?: string
  iconLeft?: string | null
  iconRight?: string | null
  onPress?: () => void | null
  onPressRight?: () => void
  textAlign?: 'center' | 'auto' | 'left' | 'right' | 'justify'
  children?: React.ReactNode
}

const Header = memo<HeaderT>(
  ({ title, iconLeft, iconRight, onPress, onPressRight, children, textAlign }) => {
    const {
      container,
      leftIconStyle,
      rightIconStyle,
      rightViewStyle,
      titleStyle,
      childrenStyle
    } = styles

    const { top } = useSafeAreaInsets()

    const width = W

    return (
      <View style={[container, { width, paddingTop: top }]}>
        {iconLeft && (
          <TouchableOpacity onPress={onPress}>
            <Emoji name={iconLeft} style={leftIconStyle} />
          </TouchableOpacity>
        )}
        {title && (
          <Text
            numberOfLines={1}
            h={'h2'}
            title={title}
            textStyle={[titleStyle, { textAlign }]}
          />
        )}
        {children && <View style={childrenStyle}>{children}</View>}
        {iconRight ? (
          <TouchableOpacity onPress={onPressRight}>
            <Emoji name={iconRight} style={rightIconStyle} />
          </TouchableOpacity>
        ) : (
          <View style={rightViewStyle} />
        )}
      </View>
    )
  }
)

export { Header }
