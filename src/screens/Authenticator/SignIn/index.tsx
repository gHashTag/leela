import React, { useState, ReactElement } from 'react'
import * as Keychain from 'react-native-keychain'
// @ts-expect-error
import { EMAIL, PASSWORD } from '@env'
import { s, vs } from 'react-native-size-matters'
import { useTheme } from '@react-navigation/native'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  AppContainer,
  Button,
  Space,
  ButtonLink,
  TextError,
  Input,
  Loading
} from '../../../components'
import {
  goBack,
  white,
  black,
  captureException,
  W,
  H,
  OpenPlanReportModal
} from '../../../constants'
import { RootStackParamList } from '../../../types'
import { I18n } from '../../../utils'
import auth from '@react-native-firebase/auth'

import {
  useForm,
  FormProvider,
  SubmitHandler,
  SubmitErrorHandler,
  FieldValues
} from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  ScrollView,
  View
} from 'react-native'
import { getProfile, onSignIn } from '../../helper'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_IN'
>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const schema = yup
  .object()
  .shape({
    email: yup
      .string()
      .email(I18n.t('invalidEmail'))
      .trim()
      .required(I18n.t('requireField')),
    password: yup
      .string()
      .required(I18n.t('requireField'))
      .min(6, I18n.t('shortPassword'))
  })
  .required()

const SignIn = ({ navigation }: SignUpT): ReactElement => {
  const [userInfo, setUserInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const initialValues = { email: EMAIL, password: PASSWORD }
  const headerHeight = useHeaderHeight()
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setUserInfo(data.email)
    setLoading(true)
    setError('')
    const { email, password } = data
    await auth()
      .signInWithEmailAndPassword(email, password)
      .then(async user => {
        await Keychain.setInternetCredentials('auth', email, password)
        await onSignIn(user.user)
      })
      .catch(err => {
        captureException(err.message)
        if (err.code === 'auth/invalid-email') {
          setError(I18n.t('invalidEmail'))
        } else if (err.code === 'auth/user-not-found') {
          setError(I18n.t('userNotFound'))
        } else if (err.code === 'auth/wrong-password') {
          setError(I18n.t('forgotPassword'))
        } else if (err.code === 'auth/network-request-failed') {
          setError(I18n.t('networkRequestFailed'))
        } else {
          setError(err.code)
          console.log(err.code)
        }
      })
    setLoading(false)
  }

  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

  const handleForgot = () => {
    navigation.navigate('FORGOT', { email: userInfo })
  }
  const { dark } = useTheme()
  const color = dark ? white : black

  return loading ? (
    <Loading />
  ) : (
    <AppContainer onPress={goBack(navigation)} title=" " colorLeft={color}>
      <KeyboardAvoidingView
        keyboardVerticalOffset={headerHeight}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={KAV}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Space height={H / 5} />
          <View style={KAV}>
            <FormProvider {...methods}>
              <Input
                name="email"
                placeholder="E-mail"
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Input
                name="password"
                placeholder={I18n.t('password')}
                secureTextEntry
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Space height={s(10)} />
              {error !== I18n.t('forgotPassword') && (
                <TextError title={error} textStyle={textStyle} />
              )}
              {error === I18n.t('forgotPassword') && (
                <ButtonLink title={error} onPress={handleForgot} textStyle={textStyle} />
              )}
              <Space height={vs(15)} />
              <Button
                title={I18n.t('signIn')}
                onPress={methods.handleSubmit(onSubmit, onError)}
              />
            </FormProvider>
          </View>
          <Space height={vs(50)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  KAV: {
    flex: 1,
    alignItems: 'center'
  },
  textStyle: {
    alignSelf: 'center'
  }
})

const { KAV, textStyle } = styles

export { SignIn }
