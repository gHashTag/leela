import React, { useState, ReactElement } from 'react'
import { KeyboardAvoidingView } from 'react-native'
import * as Keychain from 'react-native-keychain'
import Config from 'react-native-config'
import { s } from 'react-native-size-matters'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTheme } from '@react-navigation/native'
import { AppContainer, Button, Space, ButtonLink, TextError, Input, CenterView } from '../../../components'
import { goBack, white, black, captureException, W } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { I18n } from '../../../utils'
import { actionsDice } from '../../../store'
import auth from '@react-native-firebase/auth'

import { useForm, FormProvider, SubmitHandler, SubmitErrorHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_IN'>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const schema = yup.object().shape({
  email: yup.string().email().trim().required(),
  password: yup.string().min(6).required()
}).required()

const SignIn = ({ navigation }: SignUpT): ReactElement => {
  const [userInfo, setUserInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const initialValues = { email: Config.EMAIL, password: Config.PASSWORD }

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues
  })

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setUserInfo(data.email)
    setLoading(true)
    setError('')
    const { email, password } = data
    auth().signInWithEmailAndPassword(email, password).then(async (user) => {
      await Keychain.setInternetCredentials('auth', email, password)
      if (user.user.emailVerified) {
        navigation.navigate('MAIN')
        actionsDice.init()
      } else {
        navigation.navigate('CONFIRM_SIGN_UP', { email })
      }
    }).catch((err) => {
      captureException(err.message)
      if (err.code === 'auth/invalid-email') {
        setError('Invalid email')
      } else if (err.code === 'auth/user-not-found') {
        setError('user not found')
      } else if (err.code === 'auth/wrong-password') {
        setError(I18n.t('forgotPassword'))
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

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      onPress={goBack(navigation)}
      title=" "
      loading={loading}
      colorLeft={color}
    >
      <CenterView>
        <FormProvider {...methods}>
          <KeyboardAvoidingView behavior="padding">
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
            <Space height={s(20)} />
            {error !== I18n.t('forgotPassword') && <TextError title={error} textStyle={{ alignSelf: 'center' }} />}
            {error === I18n.t('forgotPassword') && (
              <ButtonLink
                title={error}
                onPress={() => navigation.navigate('FORGOT', { email: userInfo })}
                textStyle={{ alignSelf: 'center' }}
              />
            )}
            <Space height={s(30)} />
            <Button title={I18n.t('signIn')} onPress={methods.handleSubmit(onSubmit, onError)} />
          </KeyboardAvoidingView>
        </FormProvider>
      </CenterView>
    </AppContainer>
  )
}

export { SignIn }
