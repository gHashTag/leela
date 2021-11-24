import React, { useState, useEffect } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { ScaledSheet, s } from 'react-native-size-matters'
import { launchImageLibrary } from 'react-native-image-picker'
import { Txt } from '../Txt'
import { Space } from '../Space'
import { Avatar } from '../Avatar'
import { Device } from '../../constants'
import { UserT } from '../../types'
import Storage from '@aws-amplify/storage'
import { updateAvatar } from '../../store/helper'

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
    alignItems: 'center',
    top: 30
  }
})

interface HeaderMasterT {
  loading: boolean
  user: UserT
  onPress?: () => void
}

const HeaderMaster = ({ loading, user, onPress }: HeaderMasterT) => {
  const [ava, setAvatar] = useState()
  const { id, firstName, lastName, avatar, plan } = user
  useEffect(() => {
    const getImage = async () => {
      const imageKey = await Storage.get(avatar, {
        contentType: 'image/jpeg'
      })
      setAvatar({
        uri: imageKey
      })
    }
    getImage()
  }, [])

  const { container, h2, sub, avatarStyle } = styles

  const onPressAva = async () => {
    let options = {
      storageOptions: {
        mediaType: 'photo',
        includeBase64: false
      }
    }
    launchImageLibrary(options, response => {
      response?.assets &&
        response?.assets.map(({ uri, fileName }) => {
          setAvatar({
            uri,
            fileName
          })
          const setStorage = async () => {
            const photo = await fetch(uri)
            const photoBlob = await photo.blob()
            try {
              await Storage.put(fileName, photoBlob, {
                contentType: 'image/jpeg'
              })
              updateAvatar({ id, avatar: fileName })
            } catch (error) {
              console.log(`error`, error)
            }
          }
          setStorage()
        })
    })

    //const image = await createImage(ava)
  }

  return (
    <>
      <View style={sub}>
        <TouchableOpacity onPress={onPress}>
          <Avatar uri={ava?.uri} viewStyle={avatarStyle} size="xLarge" onPress={onPressAva} loading={loading} />
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
