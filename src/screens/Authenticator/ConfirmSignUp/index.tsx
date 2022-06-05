import React, { useState, ReactElement, useEffect } from 'react'
import { RouteProp } from '@react-navigation/native'
import { AppContainer, Button, Space, Text, Loading } from '../../../components'
import { white, black } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import auth from '@react-native-firebase/auth'
import { s, vs } from 'react-native-size-matters'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import I18n from 'i18n-js'
import * as Keychain from 'react-native-keychain'

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
  const [canResend, setCanResend] = useState<boolean>(true)

  useEffect(() => {
    auth().currentUser?.sendEmailVerification()
    const verfyCheck = setInterval(() => {
      auth().currentUser?.reload()
      const emailVerified = auth().currentUser?.emailVerified
      if (emailVerified !== isVerfy) {
        setIsVerfy(emailVerified)
        if (emailVerified) {
          clearInterval(verfyCheck)
          navigation.navigate('SIGN_UP_USERNAME', route.params)
        }
      }
    }, 2200)
    return () => clearInterval(verfyCheck)
  }, [])

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
    <AppContainer title=" " onPress={onExit} colorLeft={color}>
      <View style={container}>
        <Space height={vs(15)} />
        <Text h={'h1'} title={I18n.t('checkMail')} />
        <Text h={'h2'} title={`(${route.params.email})`} />
        <Loading size={s(100)} type="9CubeGrid" />
        <Space height={vs(30)} />
      </View>
      <TouchableOpacity
        disabled={!canResend}
        onPress={_onResend}
        style={[btn, !canResend && btnDisabled]}
      >
        <Text textStyle={textStyle} title={I18n.t('resendCode')} h="h3" />
      </TouchableOpacity>
      <Space height={vs(30)} />
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'center'
  },
  btnDisabled: {
    opacity: 0.5
  },
  container: {
    flex: 1,
    alignItems: 'center'
  },
  textStyle: {
    textDecorationLine: 'underline'
  }
})
const { btn, btnDisabled, textStyle, container } = styles

export { ConfirmSignUp }
