import React, { ReactElement } from 'react'

import { RouteProp } from '@react-navigation/native'
import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { vs } from 'react-native-size-matters'

import {
  AppContainer,
  Button,
  CenterView,
  Space,
  Text
} from '../../../components'
import { black, goBack, white } from '../../../constants'
import { RootStackParamList } from '../../../types/types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FORGOT_PASSWORD_SUBMIT'
>
type ProfileScreenRouteProp = RouteProp<
  RootStackParamList,
  'FORGOT_PASSWORD_SUBMIT'
>

type ForgotPassSubmitT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const ForgotPassSubmit = ({ navigation }: ForgotPassSubmitT): ReactElement => {
  const handlePress = () => {
    navigation.navigate('HELLO')
  }
  const { t } = useTranslation()
  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      title=" "
      onPress={goBack}
      colorLeft={color}
    >
      <CenterView>
        <Text h={'h1'} title={t('auth.checkMail')} />
        <Space height={vs(40)} />
        <Button title={t('clearly')} onPress={handlePress} />
      </CenterView>
    </AppContainer>
  )
}

export { ForgotPassSubmit }
