import React, { ReactElement } from 'react'

import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  AppContainer,
  Button,
  CenterView,
  IconLeela,
  Space,
  Text,
} from '../../../components'
import { black, goBack, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'HELLO'>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const page = StyleSheet.create({
  h6: { alignSelf: 'center' },
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { dark } = useTheme()
  const color = dark ? white : black
  const { t } = useTranslation()
  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      onPress={goBack}
      title=" "
      colorLeft={color}
    >
      <CenterView>
        <IconLeela />
        <Space height={s(30)} />
        <Button title={t('auth.signIn')} onPress={() => navigation.navigate('SIGN_IN')} />
        <Space height={10} />
        <Text h={'h5'} title={t('or')} textStyle={page.h6} />
        <Space height={10} />
        <Button title={t('auth.signUp')} onPress={() => navigation.navigate('SIGN_UP')} />
        <Space height={vs(140)} />
      </CenterView>
    </AppContainer>
  )
}

export { Hello }
