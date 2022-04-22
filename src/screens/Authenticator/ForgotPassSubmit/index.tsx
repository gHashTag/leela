import React, { ReactElement } from 'react'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Button, Space, Txt } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import { vs } from 'react-native-size-matters'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'FORGOT_PASSWORD_SUBMIT'>
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
    <>
      <AppContainer
        backgroundColor={dark ? black : white}
        title=" "
        onPress={goBack(navigation)}
        loading={false}
        colorLeft={color}
      >
        <Txt h0 title='Check your email!' />
        <Space height={vs(40)} />
        <Button title={I18n.t('confirm')} onPress={handlePress} color={color} />
      </AppContainer>
    </>
  )
}

export { ForgotPassSubmit }
