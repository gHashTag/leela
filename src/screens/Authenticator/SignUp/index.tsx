import React, { useState, ReactElement } from 'react'
import * as Keychain from 'react-native-keychain'
import Config from 'react-native-config'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Space, Button, Input, TextError, CenterView } from '../../../components'
import { goBack, white, black, captureException, W } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'
import auth from '@react-native-firebase/auth'

import { useForm, FormProvider, SubmitHandler, SubmitErrorHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import { s } from 'react-native-size-matters'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_UP'>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const schema = yup.object().shape({
  email: yup.string().email().trim().required(),
  password: yup.string().min(6).required(),
  passwordConfirmation: yup.string().min(6).required()
}).required()

const SignUp = ({ navigation }: SignUpT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const initialValues = { email: Config.EMAIL, password: Config.PASSWORD, passwordConfirmation: Config.PASSWORD }
  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues
  })

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    const { email, password, passwordConfirmation } = data
    if (password !== passwordConfirmation) {
      setError(I18n.t('passwordsDoNotMatch'))
    } else {
      setLoading(true)
      setError('')
      auth().createUserWithEmailAndPassword(email, password)
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
            setError('Invalid email')
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
    <AppContainer
      onPress={goBack(navigation)}
      title=" "
      loading={loading}
      colorLeft={color}
    >
      <CenterView>
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
          {error !== '' && <TextError title={error} textStyle={{ alignSelf: 'center' }} />}
          <Space height={20} />
          <Button title={I18n.t('signUp')} onPress={methods.handleSubmit(onSubmit, onError)} />
          <Space height={50} />
        </FormProvider>
      </CenterView>
    </AppContainer>
  )
}

export { SignUp }
