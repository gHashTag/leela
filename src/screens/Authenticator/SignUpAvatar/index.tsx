import React, { ReactElement, useState } from 'react'
import { s } from 'react-native-size-matters'
import { observer } from 'mobx-react-lite'
import { RouteProp } from '@react-navigation/native'
import { I18n } from '../../../utils'
import { AppContainer, Avatar, Button, CenterView, Space } from '../../../components'
import { RootStackParamList } from '../../../types'
import { OnlinePlayer } from '../../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { onSignIn } from '../../helper'
import auth from '@react-native-firebase/auth'
import { useNoBackHandler } from '../../../hooks'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_UP_AVATAR'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_AVATAR'>

type SignUpAvatarT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const SignUpAvatar = observer(({ navigation }: SignUpAvatarT): ReactElement => {
  const [load, setLoad] = useState(false)
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
    <AppContainer title=" " iconLeft={null}>
      <CenterView>
        <Avatar
          size="xLarge"
          uri={OnlinePlayer.store.avatar.slice()}
          onPress={onPressAva}
          loading={load}
        />
        <Space height={s(50)} />
        {!!OnlinePlayer.store.avatar && (
          <Button title={I18n.t('done')} onPress={handleSubmit} />
        )}
        <Space height={s(150)} />
      </CenterView>
    </AppContainer>
  )
})

export { SignUpAvatar }
