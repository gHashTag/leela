import React, { useState } from 'react'
import { useMemo } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { RouteProp, useTheme } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  FieldValues,
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
  TextError
} from '../../../components'
import { W, black, captureException, goBack, white } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FORGOT'
>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'FORGOT'>

type ForgotT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

export const Forgot = ({ route, navigation }: ForgotT) => {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          email: yup
            .string()
            .email(t('invalidEmail') || '')
            .trim()
            .required(t('requireField') || '')
        })
        .required(),
    [t]
  )

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: {
      email: route.params.email
    }
  })

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { email } = data

    try {
      await auth().sendPasswordResetEmail(email)
      navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setErrorMessage(t('userNotFound') || '')
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage(t('networkRequestFailed') || '')
      } else {
        setErrorMessage(error.code)
      }
      captureException(error.code, 'onSubmit')
    }
    setLoading(false)
  }

  const onError: SubmitErrorHandler<FieldValues> = (errors) => {
    captureException(errors, 'Forgot')
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
                <TextError title={errorMessage} textStyle={styles.errorText} />
              )}
              <Space height={vs(10)} />
              <Button
                title={t('actions.confirm')}
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

const styles = StyleSheet.create({
  errorText: {
    alignSelf: 'center'
  }
})
