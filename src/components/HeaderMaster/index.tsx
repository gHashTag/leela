import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Txt } from '../Txt'
import { ScaledSheet, s } from 'react-native-size-matters'
import { Space } from '../Space'
import { Avatar } from '../Avatar'
import { Device } from '../../constants'
import { UserT } from '../../types'

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    top: 20
  },
  avatarStyle: {
    //position: 'absolute',
    ...Device.select({
      mobile300: {
        top: 110
      },
      mobile315: {
        top: 110
      },
      iphone5: {
        top: 110
      },
      mobile342: {
        top: 110
      },
      mobile360: {
        top: 110
      },
      mobile375: {
        top: 140
      },
      mobile400: {
        top: 140
      },
      mobile410: {
        top: 160
      },
      mobile415: {
        top: 160
      },
      mobile480: {
        top: 160
      }
    })
  },
  h2: {
    top: 10
  },
  sub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
})

interface HeaderMasterT {
  loading: boolean
  user: UserT
  onPress?: () => void
}

const HeaderMaster = ({ loading, user, onPress }: HeaderMasterT) => {
  const { container, h2, sub, avatarStyle } = styles
  const { firstName, lastName, avatar, plan } = user
  return (
    <>
      <View style={sub}>
        <TouchableOpacity style={container} onPress={onPress}>
          <Avatar avatar={avatar} viewStyle={avatarStyle} size="xLarge" onPress={onPress} loading={loading} />
        </TouchableOpacity>
        <Space width={s(50)} />
        <Txt h7 title={String(plan)} textStyle={h2} />
      </View>
      <TouchableOpacity style={container} onPress={onPress}>
        <Space height={30} />
        <Txt h0 title={firstName} textStyle={h2} />
        <Txt h0 title={lastName} textStyle={h2} />
        <Space width={60} />
      </TouchableOpacity>
    </>
  )
}

export { HeaderMaster }
