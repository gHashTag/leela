import React, { ReactElement } from 'react'
import { s } from 'react-native-size-matters'
import { observer } from 'mobx-react-lite'
import { RouteProp, useTheme } from '@react-navigation/native'
import { I18n } from '../../../utils'
import {
  AppContainer,
  Avatar,
  Button,
  CenterView,
  Space
} from '../../../components'
import { goBack } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { OnlinePlayer } from '../../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

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
  const onPressAva = async () => {
    OnlinePlayer.uploadImage()
  }
  const handleSubmit = () =>
    navigation.navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
  return (
    <AppContainer onPress={goBack(navigation)} title=" " iconLeft={null}>
      <CenterView>
        <Avatar
          size="xLarge"
          uri={OnlinePlayer.store.avatar.slice()}
          onPress={onPressAva}
          loading={false}
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
