import React, { useState, ReactElement, useEffect } from 'react'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Button, Space, Text, Loading } from '../../../components'
import { goBack, white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import auth from '@react-native-firebase/auth'
import { s, vs } from 'react-native-size-matters'
import { TouchableOpacity, View } from 'react-native'
import { actionsDice } from '../../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CONFIRM_SIGN_UP'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'CONFIRM_SIGN_UP'>

type ConfirmSignUpT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const ConfirmSignUp = ({ route, navigation }: ConfirmSignUpT): ReactElement => {
  const [isVerfy, setIsVerfy] = useState<boolean | undefined>(false)

  useEffect(() => {
    const verfyCheck = setInterval(() => {
      auth().currentUser?.reload()
      const emailVerified = auth().currentUser?.emailVerified
      if (emailVerified !== isVerfy) {
        setIsVerfy(emailVerified)
        if (emailVerified) {
          clearInterval(verfyCheck)
          actionsDice.init()
          navigation.navigate('SIGN_UP_USERNAME', route.params)
        }
      }
    }, 2200)
    return () => clearInterval(verfyCheck)
  }, [])

  const _onResend = async (): Promise<void> => {
    auth().currentUser?.sendEmailVerification()
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer title=" " onPress={goBack(navigation)} colorLeft={color}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Space height={vs(15)} />
        <Text h={'h1'} title={I18n.t('checkMail')} />
        <Loading size={s(100)} type="9CubeGrid" />
        <Space height={vs(30)} />
      </View>
      <TouchableOpacity onPress={_onResend} style={{ alignSelf: 'center' }}>
        <Text
          textStyle={{ textDecorationLine: 'underline' }}
          title={I18n.t('resendCode')}
          h="h3"
        />
      </TouchableOpacity>
      <Space height={vs(30)} />
    </AppContainer>
  )
}

export { ConfirmSignUp }
