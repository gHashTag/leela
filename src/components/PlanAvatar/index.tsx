import { useTheme } from '@react-navigation/native'
import React, { memo, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  ImageStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  View
} from 'react-native'
import FastImage from 'react-native-fast-image'
import { ms, s } from 'react-native-size-matters'
import Ionicons from 'react-native-vector-icons/Ionicons'

import { Text } from '..'
import { orange, primary } from '../../constants'

interface PlanAvatarI {
  plan: number
  size: 'xLarge' | 'large' | 'medium' | 'small'
  avaUrl?: string | number
  isAccept?: boolean
  aditionalStyle?: StyleProp<ImageStyle>
  onPress?: () => void
  testID?: string
}

const isNumber = (value?: string | number): value is number =>
  typeof value === 'number'

export const PlanAvatar = memo(function ({
  size = 'medium',
  plan,
  avaUrl,
  aditionalStyle,
  isAccept,
  onPress,
  testID
}: PlanAvatarI) {
  const {
    colors: { background }
  } = useTheme()
  const [loaded, setLoaded] = useState(false)
  const textPlan = plan < 10 ? `0${plan}` : `${plan}`
  const fontSize = size === 'small' ? s(6) : s(10)
  const badgeS = size === 'small' || size === 'medium' ? smallBadge : bigBadge

  const isLocalImage = isNumber(avaUrl)

  return (
    <Pressable onPress={onPress} testID={testID}>
      <View style={[styles[size], aditionalStyle, styles.wrapper]}>
        {isLocalImage ? (
          <ImageBackground
            source={avaUrl as number}
            style={StyleSheet.absoluteFill}
            imageStyle={container}
          />
        ) : (
          <FastImage
            source={{ uri: avaUrl, priority: FastImage.priority.normal }}
            style={[StyleSheet.absoluteFill, styles.roundImage]}
            resizeMode="cover"
            onLoadStart={() => setLoaded(false)}
            onLoadEnd={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        {!loaded && !isLocalImage && (
          <View style={[styles.placeholder, { backgroundColor: background }]}>
            <ActivityIndicator size="small" color={primary} />
          </View>
        )}
        <View style={[badge, badgeS, { backgroundColor: background }]}>
          {!isAccept ? (
            <Ionicons size={s(15)} color={orange} name="time-sharp" />
          ) : (
            <Text textStyle={{ fontSize }} title={textPlan} h="h12" />
          )}
        </View>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  xLarge: {
    marginLeft: 1,
    width: ms(130),
    height: ms(130)
  },
  large: {
    marginLeft: 1,
    width: s(55),
    height: s(55)
  },
  medium: {
    width: ms(50, 0.9),
    height: ms(50, 0.9)
  },
  small: {
    width: s(36),
    height: s(36)
  },
  container: {
    borderRadius: ms(130),
    borderColor: primary,
    borderWidth: s(0.9)
  },
  wrapper: {
    overflow: 'hidden'
  },
  roundImage: {
    borderRadius: ms(130)
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(130),
    flexDirection: 'row',
    position: 'absolute',
    borderColor: primary,
    borderWidth: s(0.8),
    padding: s(2)
  },
  smallBadge: {
    right: s(-1),
    bottom: s(1)
  },
  bigBadge: {
    right: s(-1),
    bottom: s(2)
  }
})

const { container, badge, bigBadge, smallBadge } = styles
