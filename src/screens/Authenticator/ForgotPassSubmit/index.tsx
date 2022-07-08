import React, { ReactElement } from 'react'
import { I18n } from '../../../utils'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Button, CenterView, Space, Text } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import { vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FORGOT_PASSWORD_SUBMIT'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'FORGOT_PASSWORD_SUBMIT'>

type ForgotPassSubmitT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const ForgotPassSubmit = ({ route, navigation }: ForgotPassSubmitT): ReactElement => {
  const handlePress = () => {
    navigation.navigate('WELCOME_SCREEN')
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer iconLeft={'back'} title=" " onPress={goBack} colorLeft={color}>
      <CenterView>
        <Text h={'h1'} title={I18n.t('checkMail')} />
        <Space height={vs(40)} />
        <Button title={I18n.t('clearly')} onPress={handlePress} />
      </CenterView>
    </AppContainer>
  )
}

export { ForgotPassSubmit }
