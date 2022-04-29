import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { ScaledSheet, s, vs } from 'react-native-size-matters'
import { Text } from '../Text'
import { Space } from '../Space'
import { Avatar } from '../Avatar'
import { Device } from '../../constants'
import {
  DiceStore,
  OfflinePlayers,
  OnlinePlayer,
  OtherPlayers,
  PostStore
} from '../../store'
import { observer } from 'mobx-react-lite'
import { isObservable } from 'mobx'

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    top: 20,
    alignItems: 'center'
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
    top: vs(9)
  },
  sub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    top: 30
  }
})

interface HeaderMasterT {
  onPress: () => void
  onPressAva: () => void
  loading?: boolean
}

const HeaderMaster = observer(
  ({ onPress, onPressAva, loading = false }: HeaderMasterT) => {
    const { firstName, lastName } = OnlinePlayer.store.profile
    const { container, h2, sub, avatarStyle } = styles
    return (
      <>
        <View style={sub}>
          <TouchableOpacity onPress={onPress}>
            <Avatar
              uri={OnlinePlayer.store.avatar}
              viewStyle={avatarStyle}
              size="xLarge"
              onPress={onPressAva}
              loading={loading}
            />
          </TouchableOpacity>
          <Space width={s(50)} />
          <Text h={'h0'} title={String(OnlinePlayer.store.plan)} textStyle={h2} />
        </View>
        <TouchableOpacity style={container} onPress={onPress}>
          <Space height={30} />
          <Text h={'h1'} title={firstName} textStyle={h2} />
          <Text h={'h1'} title={lastName} textStyle={h2} />
          <Space width={60} />
        </TouchableOpacity>
      </>
    )
  }
)

export { HeaderMaster }
