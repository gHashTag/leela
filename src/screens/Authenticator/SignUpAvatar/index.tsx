import React, { ReactElement } from 'react'
import { s } from 'react-native-size-matters'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { I18n } from '../../../utils'
import { AppContainer, Avatar, Button, CenterView, Space } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { actionPlayers, OnlinePlayerStore } from '../../../store'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_UP_AVATAR'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'SIGN_UP_AVATAR'>

type SignUpAvatarT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const SignUpAvatar = observer(({ navigation }: SignUpAvatarT): ReactElement => {
  const onPressAva = async () => {
    actionPlayers.uploadImage()
  }

  const { dark } = useTheme()
  const color = dark ? white : black
  const handleSubmit = () => navigation.navigate('MAIN')
  return <AppContainer
    onPress={goBack(navigation)}
    title=" "
    iconLeft={null}
    loading={false}
  >
    <CenterView>
      <Avatar size="xLarge" uri={OnlinePlayerStore.avatar.slice()} onPress={onPressAva} loading={false} />
      <Space height={s(50)} />
      {!!OnlinePlayerStore.avatar && <Button title={I18n.t('done')} onPress={handleSubmit} color={color} />}

      <Space height={s(150)} />
    </CenterView>
  </AppContainer>
})

export { SignUpAvatar }
