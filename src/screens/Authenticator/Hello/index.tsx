import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { useKeychain } from 'src/hooks'

import {
  AppContainer,
  Button,
  CenterView,
  IconLeela,
  Loading,
  Space,
  Text
} from '../../../components'
import { black, goBack, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'HELLO'
>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const page = StyleSheet.create({
  h6: { alignSelf: 'center' }
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { loading } = useKeychain()
  const { dark } = useTheme()
  const color = dark ? white : black
  const { t } = useTranslation()
  return (
    <AppContainer
      enableBackgroundBottomInsets
      onPress={goBack}
      title=" "
      colorLeft={color}
      hidestar
    >
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <IconLeela />
          <Space height={s(70)} />
          <Button
            title={t('auth.signIn')}
            onPress={() => navigation.navigate('SIGN_IN')}
          />
          <Space height={10} />
          {/* <Text h={'h5'} title={t('or')} textStyle={page.h6} /> */}
          <Space height={10} />
          <Button
            title={t('auth.signUp')}
            onPress={() => navigation.navigate('SIGN_UP')}
          />
          <Space height={10} />
          <Text h={'h5'} title={t('or')} textStyle={page.h6} />
          <Space height={10} />
          <Button
            title={t('offline')}
            onPress={() => navigation.navigate('SELECT_PLAYERS_SCREEN')}
          />
          <Space height={vs(50)} />
        </CenterView>
      )}
    </AppContainer>
  )
}

export { Hello }
