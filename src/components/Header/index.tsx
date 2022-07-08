import React, { memo } from 'react'
import { Platform, TouchableOpacity, View } from 'react-native'
import Emoji from 'react-native-emoji'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScaledSheet, s, ms, vs, mvs } from 'react-native-size-matters'
import { Text, Space } from '../'
import { navigate } from '../../constants'
const isIos = Platform.OS === 'ios'
const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: mvs(1, 0.4),
    zIndex: 20,
    width: '100%'
  },
  leftIconStyle: {
    fontSize: isIos ? s(26) : s(22),
    textAlign: 'center',
    alignItems: 'center',
    paddingTop: s(2),
    marginHorizontal: s(8),
    marginVertical: s(5)
  },
  rightIconStyle: {
    fontSize: isIos ? s(30) : s(28),
    textAlign: 'center',
    alignItems: 'center',
    marginHorizontal: s(8),
    marginVertical: s(5)
  },
  rightViewStyle: {
    width: isIos ? s(60) : s(44)
  },
  titleStyle: {
    flex: 1,
    fontSize: vs(18),
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
  iconLeftOpacity?: number
  textAlign?: 'center' | 'auto' | 'left' | 'right' | 'justify'
  children?: React.ReactNode
}

const Header = memo<HeaderT>(
  ({
    title,
    iconLeft = ':information_source:',
    iconRight = ':books:',
    onPress = () => {
      navigate('RULES_SCREEN')
    },
    onPressRight = () => {
      navigate('PLANS_SCREEN')
    },
    iconLeftOpacity = 1,
    children,
    textAlign
  }) => {
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
    const marginTop = children ? s(13) : 0
    return (
      <View style={[container, { paddingTop: top, alignItems }]}>
        {iconLeft && (
          <TouchableOpacity style={{ opacity: iconLeftOpacity }} onPress={onPress}>
            <Emoji name={iconLeft} style={leftIconStyle} />
          </TouchableOpacity>
        )}
        {title && (
          <Text
            numberOfLines={1}
            h={'h2'}
            title={title}
            textStyle={[titleStyle, { textAlign, marginTop }]}
          />
        )}
        {children && (
          <View style={[childrenStyle, !title && { marginTop }]}>{children}</View>
        )}
        {iconRight ? (
          <TouchableOpacity onPress={onPressRight}>
            <Emoji name={iconRight} style={rightIconStyle} />
          </TouchableOpacity>
        ) : (
          iconLeft && <View style={rightViewStyle} />
        )}
      </View>
    )
  }
)

export { Header }
