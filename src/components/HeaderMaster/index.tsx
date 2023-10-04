import React, { useEffect } from 'react'

import { observer } from 'mobx-react'
import { View } from 'react-native'
import { ScaledSheet, s, vs } from 'react-native-size-matters'

import { useActions } from './useActions'

import { Text } from '../'
import { PressableAvatar } from '../Avatar'
import { Pressable } from '../Pressable'
import { Space } from '../Space'
import { useChooseAvatarImage } from '../../hooks/useChooseAvatarImage'
import { captureException } from '../../constants'

interface HeaderMasterT {
  avatar: string
  plan: number
  firstName?: string
  lastName?: string
  fullName?: string
  onPressName?: () => void
  editable?: boolean
}

const HeaderMaster = observer(
  ({
    onPressName,
    editable,
    avatar,
    plan,
    firstName = '',
    lastName = '',
    fullName = ''
  }: HeaderMasterT) => {
    const { onPressEdit } = useActions()
    const { ava, chooseAvatarImage, isLoading, setAva } = useChooseAvatarImage()

    useEffect(() => {
      setAva(avatar)
    }, [avatar, setAva])

    const onPressChangeAva = async () => {
      try {
        chooseAvatarImage()
      } catch (error) {
        captureException(error, 'useActions')
      }
    }

    return (
      <View style={rootContainer}>
        <View style={subAvaContainer}>
          <PressableAvatar
            uri={ava}
            size="xLarge"
            loading={isLoading}
            onPress={editable ? onPressChangeAva : undefined}
          />

          <View style={planAndEditBlock}>
            <Pressable
              style={wide}
              onPress={editable ? onPressEdit : undefined}
            >
              <Text h="h0" textStyle={planNumber} title={String(plan)} />
            </Pressable>
          </View>
        </View>

        <Pressable style={container} onPress={onPressName}>
          {fullName ? (
            <Text h={'h1'} title={fullName} />
          ) : (
            <>
              <Text h={'h1'} title={firstName} />
              <Space width={s(10)} />
              <Text h={'h1'} title={lastName} />
            </>
          )}
        </Pressable>
      </View>
    )
  }
)

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
    right: s(65),
    top: -s(3)
  },
  planNumber: {},
  rootContainer: {
    width: '80%',
    alignSelf: 'center'
  }
})
const {
  container,
  subAvaContainer,
  wide,
  editIcon,
  planAndEditBlock,
  planNumber,
  rootContainer
} = styles

export { HeaderMaster }
