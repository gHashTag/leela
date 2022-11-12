import React, { useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  FieldValues,
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useForm,
} from 'react-hook-form'
import { StyleSheet } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import * as yup from 'yup'

import {
  AppContainer,
  Button,
  CenterView,
  Input,
  KeyboardContainer,
  Loading,
  Space,
  TextError,
} from '../../../components'
import { W, black, captureException, goBack, white } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { I18n } from '../../../utils'

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FORGOT'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'FORGOT'>

type ForgotT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const schema = yup
  .object()
  .shape({
    email: yup
      .string()
      .email(I18n.t('invalidEmail'))
      .trim()
      .required(I18n.t('requireField')),
  })
  .required()

export const Forgot = ({ route, navigation }: ForgotT) => {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: {
      email: route.params.email,
    },
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { email } = data

    try {
      await auth().sendPasswordResetEmail(email)
      navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setErrorMessage(I18n.t('userNotFound'))
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage(I18n.t('networkRequestFailed'))
      } else {
        setErrorMessage(error.code)
      }
      captureException(error.code)
    }
    setLoading(false)
  }

  const onError: SubmitErrorHandler<FieldValues> = errors => {
    console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      iconLeft={'back'}
      title=" "
      onPress={goBack}
      enableBackgroundBottomInsets
      message={errorMessage}
      colorLeft={color}
    >
      {loading ? (
        <Loading />
      ) : (
        <KeyboardContainer>
          <CenterView>
            <FormProvider {...methods}>
              <Input
                name="email"
                placeholder="E-mail"
                autoCapitalize="none"
                color={color}
                additionalStyle={{ width: W - s(40) }}
              />
              <Space height={vs(15)} />
              {errorMessage !== '' && (
                <TextError title={errorMessage} textStyle={page.errorText} />
              )}
              <Space height={vs(10)} />
              <Button
                title={I18n.t('confirm')}
                onPress={methods.handleSubmit(onSubmit, onError)}
              />
            </FormProvider>
            <Space height={vs(10)} />
          </CenterView>
        </KeyboardContainer>
      )}
    </AppContainer>
  )
}

const page = StyleSheet.create({
  errorText: {
    alignSelf: 'center',
  },
})
