import React, { ReactElement, useState } from 'react'

import auth from '@react-native-firebase/auth'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { s } from 'react-native-size-matters'

import { AppContainer, Avatar, Button, CenterView, Space } from '../../../components'
import { useNoBackHandler } from '../../../hooks'
import { OnlinePlayer } from '../../../store'
import { RootStackParamList } from '../../../types'
import { onSignIn } from '../../helper'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_UP_AVATAR'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_AVATAR'>

type SignUpAvatarT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const SignUpAvatar = observer(({}: SignUpAvatarT): ReactElement => {
  const [load, setLoad] = useState(false)
  const { t } = useTranslation()

  const onPressAva = async () => {
    setLoad(true)
    await OnlinePlayer.uploadImage()
    setLoad(false)
  }
  const handleSubmit = () => {
    const user = auth().currentUser
    if (user) {
      onSignIn(user)
    }
  }
  useNoBackHandler()

  return (
    <AppContainer
      enableBackgroundBottomInsets
      enableBackgroundTopInsets
      title=" "
      iconLeft={null}
    >
      <CenterView>
        <TouchableOpacity onPress={onPressAva}>
          <Avatar size="xLarge" uri={OnlinePlayer.store.avatar.slice()} loading={load} />
        </TouchableOpacity>

        <Space height={s(50)} />
        {!!OnlinePlayer.store.avatar && (
          <Button title={t('done')} onPress={handleSubmit} />
        )}
        <Space height={s(150)} />
      </CenterView>
    </AppContainer>
  )
})

export { SignUpAvatar }
