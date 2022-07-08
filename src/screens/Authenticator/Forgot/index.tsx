import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { RouteProp, useTheme } from '@react-navigation/native'
import {
  AppContainer,
  Button,
  CenterView,
  Input,
  Loading,
  Space,
  TextError
} from '../../../components'
import { goBack, white, black, captureException, W } from '../../../constants'
import { RootStackParamList } from '../../../types'
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
      .required(I18n.t('requireField'))
  })
  .required()

const Forgot = ({ route, navigation }: ForgotT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: {
      email: route.params.email
    }
  })

  const onSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    const { email } = data
    try {
      await auth().sendPasswordResetEmail(email)
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setError(I18n.t('userNotFound'))
      } else if (error.code === 'auth/network-request-failed') {
        setError(I18n.t('networkRequestFailed'))
      } else {
        setError(error.code)
      }
      captureException(error.code)
    }
    setLoading(false)
  }

  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      iconLeft={'back'}
      title=" "
      onPress={goBack}
      message={error}
      colorLeft={color}
    >
      {loading ? (
        <Loading />
      ) : (
        <CenterView>
          <FormProvider {...methods}>
            <Input
              name="email"
              placeholder="E-mail"
              autoCapitalize="none"
              color={color}
              additionalStyle={{ width: W - s(40) }}
            />
            <Space height={vs(20)} />
            {error !== '' && (
              <TextError title={error} textStyle={{ alignSelf: 'center' }} />
            )}
            <Space height={vs(10)} />
            <Button
              title={I18n.t('confirm')}
              onPress={methods.handleSubmit(onSubmit, onError)}
            />
          </FormProvider>
          <Space height={vs(40)} />
        </CenterView>
      )}
    </AppContainer>
  )
}

export { Forgot }
