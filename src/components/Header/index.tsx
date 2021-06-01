import React, { memo } from 'react'
import { TouchableOpacity, View, useWindowDimensions, Platform } from 'react-native'
import Emoji from 'react-native-emoji'
import { ScaledSheet, s, ms } from 'react-native-size-matters'
import { Txt } from '../Txt'

const styles = ScaledSheet.create({
  container: {
    height: ms(60, 0.6),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  leftIconStyle: {
    fontSize: Platform.OS === 'ios' ? '33@ms' : '28@ms',
    width: ms(60, 0.5),
    height: ms(60, 0.5),
    textAlign: 'center',
    top: ms(20, 0.8),
    left: s(5)
  },
  rightIconStyle: {
    fontSize: Platform.OS === 'ios' ? '40@ms' : '32@ms',
    width: ms(60, 0.5),
    height: ms(60, 0.5),
    textAlign: 'center',
    top: ms(20, 0.8),
    right: s(5)
  },
  rightViewStyle: {
    width: ms(20, 0.5)
  },
  titleStyle: {
    flex: 1,
    fontSize: 28,
    textAlign: 'left',
    left: 5,
    top: s(10)
  },
  childrenStyle: {
    top: ms(5, 2.8)
  }
})

interface HeaderT {
  title?: string
  iconLeft?: string | null
  iconRight?: string | null
  onPress?: () => void
  onPressRight?: () => void
  textAlign?: string
  children?: React.ReactNode
}

const Header = memo<HeaderT>(({ title, iconLeft, iconRight, onPress, onPressRight, children, textAlign = 'left' }) => {
  const { container, leftIconStyle, rightIconStyle, rightViewStyle, titleStyle, childrenStyle } = styles

  const width = useWindowDimensions().width

  return (
    <View style={[container, { width }]}>
      {iconLeft && (
        <TouchableOpacity onPress={onPress}>
          <Emoji name={iconLeft} style={leftIconStyle} />
        </TouchableOpacity>
      )}
      {title && <Txt numberOfLines={1} h4 title={title} textStyle={titleStyle} textAlign={textAlign} />}
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
})

export { Header }
