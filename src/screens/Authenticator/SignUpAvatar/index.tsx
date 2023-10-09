import React, { ReactElement } from 'react'

import auth from '@react-native-firebase/auth'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { s } from 'react-native-size-matters'

import {
  AppContainer,
  Avatar,
  Button,
  CenterView,
  Space
} from '../../../components'
import { Pressable } from '../../../components/Pressable'
import { useNoBackHandler } from '../../../hooks'
import { OnlinePlayer } from '../../../store'
import { RootStackParamList } from '../../../types/types'
import { onSignIn } from '../../helper'
import { useChooseAvatarImage } from '../../../hooks/useChooseAvatarImage'

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
  const { t } = useTranslation()
  const { ava, chooseAvatarImage, isLoading } = useChooseAvatarImage()

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
        <Pressable onPress={chooseAvatarImage}>
          <Avatar size="xLarge" uri={ava} loading={isLoading} />
        </Pressable>

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
