import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { ScaledSheet, s, vs } from 'react-native-size-matters'
import { Text } from '../'
import { Space } from '../Space'
import { Avatar } from '../Avatar'
import { OnlinePlayer } from '../../store'
import { observer } from 'mobx-react'
import { BlurView } from '@react-native-community/blur'
import Icon from 'react-native-vector-icons/Ionicons'
import { useTheme } from '@react-navigation/native'
import { useActions } from './useActions'

interface HeaderMasterT {
  onPress: () => void
}

const HeaderMaster = observer(({ onPress }: HeaderMasterT) => {
  const { loadImage, onPressEdit } = useActions()
  const { firstName, lastName } = OnlinePlayer.store.profile
  const {
    dark,
    colors: { border }
  } = useTheme()

  return (
    <View style={rootContainer}>
      <TouchableOpacity activeOpacity={0.8} style={wide} onPress={onPressEdit}>
        {/* <BlurView
          style={avaContainer}
          blurType={dark ? 'dark' : 'light'}
          blurAmount={5}
        /> */}
        <View style={subAvaContainer}>
          <Avatar uri={OnlinePlayer.store.avatar} size="xLarge" loading={loadImage} />
          <View style={planAndEditBlock}>
            <Icon style={editIcon} name="md-pencil" color={border} size={s(12)} />
            <Text h="h0" textStyle={planNumber} title={String(OnlinePlayer.store.plan)} />
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={container} onPress={onPress}>
        <Text h={'h1'} title={firstName} />
        <Space width={s(10)} />
        <Text h={'h1'} title={lastName} />
      </TouchableOpacity>
    </View>
  )
})

const styles = ScaledSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: vs(10)
  },
  avaContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%'
  },
  subAvaContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingVertical: vs(10),
    paddingRight: s(20),
    paddingLeft: s(15)
  },
  wide: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: s(20),
    marginTop: vs(25)
  },
  planAndEditBlock: {
    flex: 1,
    height: '100%',
    flexDirection: 'column-reverse',
    alignItems: 'flex-end'
  },
  editIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(5),
    zIndex: 2,
    position: 'absolute',
    right: -s(5),
    top: -s(3)
  },
  planNumber: {
    bottom: s(12)
  },
  rootContainer: {
    width: '80%',
    alignSelf: 'center'
  }
})
const {
  container,
  avaContainer,
  subAvaContainer,
  wide,
  editIcon,
  planAndEditBlock,
  planNumber,
  rootContainer
} = styles

export { HeaderMaster }
