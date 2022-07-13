import React, { memo } from 'react'
import { Platform, TouchableOpacity, View } from 'react-native'
import Emoji from 'react-native-emoji'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScaledSheet, s, vs, mvs } from 'react-native-size-matters'
import { Text, HeaderMessage } from '../'
import { navigate } from '../../constants'
const isIos = Platform.OS === 'ios'
const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: mvs(1, 0.4),
    zIndex: 20
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
    fontSize: vs(18)
  },
  childrenStyle: {}
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
  displayStatus?: boolean
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
    textAlign,
    displayStatus
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
    const marginTop = children ? s(2) : 0
    return (
      <View style={[container, { paddingTop: top, alignItems }]}>
        {iconLeft && (
          <TouchableOpacity style={{ opacity: iconLeftOpacity }} onPress={onPress}>
            <Emoji name={iconLeft} style={leftIconStyle} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          {title && !displayStatus && (
            <Text
              numberOfLines={1}
              h={'h2'}
              title={title}
              textStyle={[titleStyle, { textAlign, marginTop }]}
            />
          )}
          {(children || displayStatus) && (
            <View style={[childrenStyle, !title && { marginTop }]}>
              {displayStatus && !children && <HeaderMessage />}
              {children}
            </View>
          )}
        </View>
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
