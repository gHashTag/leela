import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'

import { Txt } from '../Txt'
import { Space } from '../Space'
import { Avatar } from '../Avatar'
import { Device } from '../../constants'
import { UserT } from '../../types'
import { OnlinePlayerStore } from '../../store'
import { observer } from 'mobx-react-lite'

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    top: 20
  },
  avatarStyle: {
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
    alignItems: 'center',
    top: 30
  }
})

interface HeaderMasterT {
  avatar: string
  plan: number
  onPress: () => void
  onPressAva: () => void
  loading?: boolean
}

const HeaderMaster = observer(({ avatar, onPress, onPressAva, plan, loading = false }: HeaderMasterT) => {
  const { firstName, lastName } = OnlinePlayerStore.profile
  const { container, h2, sub, avatarStyle } = styles

  return (
    <>
      <View style={sub}>
        <TouchableOpacity onPress={onPress}>
          <Avatar uri={avatar} viewStyle={avatarStyle} size="xLarge" onPress={onPressAva} loading={loading} />
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
})

export { HeaderMaster }
