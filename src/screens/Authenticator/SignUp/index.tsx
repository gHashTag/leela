import React, { useState, ReactElement } from 'react'
import * as Keychain from 'react-native-keychain'
// @ts-expect-error
import { EMAIL, PASSWORD } from '@env'
import { I18n } from '../../../utils'
import {
  AppContainer,
  Space,
  Button,
  Input,
  TextError,
  Loading
} from '../../../components'
import { useHeaderHeight } from '@react-navigation/elements'
import { goBack, white, black, captureException, W, H } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
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
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SIGN_UP'
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
      .min(6, I18n.t('shortPassword')),
    passwordConfirmation: yup
      .string()
      .required(I18n.t('requireField'))
      .min(6, I18n.t('shortPassword'))
  })
  .required()

const SignUp = ({ navigation }: SignUpT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const initialValues = {
    email: EMAIL,
    password: PASSWORD,
    passwordConfirmation: PASSWORD
  }
  const headerHeight = useHeaderHeight()
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    const { email, password, passwordConfirmation } = data
    if (password !== passwordConfirmation) {
      setError(I18n.t('passwordsDoNotMatch'))
    } else {
      setLoading(true)
      setError('')
      await auth()
        .createUserWithEmailAndPassword(email, password)
        .then(async () => {
          await Keychain.setInternetCredentials('auth', email, password)
          auth().currentUser?.sendEmailVerification()
          navigation.navigate('CONFIRM_SIGN_UP', { email, password })
          setLoading(false)
        })
        .catch(error => {
          console.log(error)
          setLoading(false)
          captureException(error.code)
          if (error.code === 'auth/email-already-in-use') {
            setError(I18n.t('usernameExistsException'))
          } else if (error.code === 'auth/invalid-email') {
            setError(I18n.t('invalidEmail'))
          } else if (error.code === 'auth/network-request-failed') {
            setError(I18n.t('networkRequestFailed'))
          } else {
            setError(error.code)
          }
        })
    }
  }

  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer onPress={goBack(navigation)} title=" " colorLeft={color}>
      {loading ? (
        <Loading />
      ) : (
        <>
          <KeyboardAvoidingView
            keyboardVerticalOffset={headerHeight}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.KAV}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Space height={H / 7} />
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
                <Input
                  name="passwordConfirmation"
                  placeholder={I18n.t('passwordConfirmation')}
                  secureTextEntry
                  color={color}
                  additionalStyle={{ width: W - s(40) }}
                />
                <Space height={30} />
                {error !== '' && (
                  <TextError title={error} textStyle={{ textAlign: 'center' }} />
                )}
                <Space height={20} />
                <Button
                  title={I18n.t('signUp')}
                  onPress={methods.handleSubmit(onSubmit, onError)}
                />
                <Space height={50} />
              </FormProvider>
            </ScrollView>
          </KeyboardAvoidingView>
        </>
      )}
    </AppContainer>
  )
}

const styles = StyleSheet.create({
  KAV: {
    flex: 1,
    alignItems: 'center'
  }
})

export { SignUp }
