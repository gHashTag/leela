import React, { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Emoji from 'react-native-emoji'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScaledSheet, s, ms, vs, mvs } from 'react-native-size-matters'
import { W } from '../../constants'
import { Text } from '../Text'

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: mvs(1, 0.4),
    zIndex: 20,
    width: '100%'
  },
  leftIconStyle: {
    fontSize: s(22),
    textAlign: 'center',
    alignItems: 'center',
    marginHorizontal: s(8),
    marginVertical: s(5)
  },
  rightIconStyle: {
    fontSize: s(28),
    textAlign: 'center',
    alignItems: 'center',
    marginHorizontal: s(8),
    marginVertical: s(5)
  },
  rightViewStyle: {
    width: ms(20, 0.5)
  },
  titleStyle: {
    flex: 1,
    fontSize: vs(28),
    left: 5
  },
  childrenStyle: {
    marginTop: s(2)
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
    const alignItems = children ? 'flex-start' : 'center'
    return (
      <View style={[container, { paddingTop: top, alignItems }]}>
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
