import React, { ReactElement, useEffect, useState } from 'react'

import auth from '@react-native-firebase/auth'
import { RouteProp } from '@react-navigation/native'
import { useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import * as Keychain from 'react-native-keychain'
import { s, vs } from 'react-native-size-matters'

import { AppContainer, Loading, Space, Text } from '../../../components'
import { black, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CONFIRM_SIGN_UP'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'CONFIRM_SIGN_UP'>

type ConfirmSignUpT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

export const ConfirmSignUp = ({ route, navigation }: ConfirmSignUpT): ReactElement => {
  const [isVerify, setIsVerify] = useState<boolean | undefined>(false)
  const [canResend, setCanResend] = useState<boolean>(true)

  useEffect(() => {
    auth().currentUser?.sendEmailVerification()
    const verifyCheck = setInterval(() => {
      auth().currentUser?.reload()
      const emailVerified = auth().currentUser?.emailVerified
      if (emailVerified !== isVerify) {
        setIsVerify(emailVerified)
        if (emailVerified) {
          clearInterval(verifyCheck)
          navigation.navigate('SIGN_UP_USERNAME', route.params)
        }
      }
    }, 2200)
    return () => clearInterval(verifyCheck)
  }, [navigation, isVerify, route.params])

  const _onResend = async (): Promise<void> => {
    if (canResend) {
      auth().currentUser?.sendEmailVerification()
      setCanResend(false)
      setTimeout(() => setCanResend(true), 40000)
    }
  }

  const onExit = async () => {
    await Keychain.resetInternetCredentials('auth')
    await auth().signOut()
    navigation.goBack()
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      enableBackgroundBottomInsets
      iconLeft={'back'}
      title=" "
      onPress={onExit}
      colorLeft={color}
    >
      <View style={page.container}>
        <Space height={vs(15)} />
        <Text h={'h1'} title={I18n.t('checkMail')} />
        <Text h={'h2'} title={`(${route.params.email})`} />
        <Loading size={s(100)} type="9CubeGrid" />
        <Space height={vs(30)} />
      </View>
      <TouchableOpacity
        disabled={!canResend}
        onPress={_onResend}
        style={[page.btn, !canResend && page.btnDisabled]}
      >
        <Text textStyle={page.textStyle} title={I18n.t('resendCode')} h="h3" />
      </TouchableOpacity>
      <Space height={vs(30)} />
    </AppContainer>
  )
}

const page = StyleSheet.create({
  btn: {
    alignSelf: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  textStyle: {
    textDecorationLine: 'underline',
  },
})
