import React, { useState, ReactElement } from 'react'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { AppContainer, Button, CenterView, Input, Space } from '../../../components'
import { goBack, white, black, captureException, W } from '../../../constants'
import { RootStackParamList } from '../../../types'
import auth from '@react-native-firebase/auth'

import { useForm, FormProvider, SubmitHandler, SubmitErrorHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import { s, vs } from 'react-native-size-matters'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'FORGOT'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'FORGOT'>

type ForgotT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const schema = yup.object().shape({
  email: yup.string().email().trim().required()
}).required()

const Forgot = ({ route, navigation }: ForgotT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
  })

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { email } = data
    await auth().sendPasswordResetEmail(email).then(() => {
      navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })
    }).catch((err) => {
      setError(err.code)
      captureException(err.code)
    })
    setLoading(false)
  }

  const onError: SubmitErrorHandler<FieldValues> = (errors, e) => {
    return console.log(errors)
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return <AppContainer
    title=" "
    onPress={goBack(navigation)}
    message={error}
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
        <Space height={vs(20)} />
        <Button title={I18n.t('confirm')} onPress={methods.handleSubmit(onSubmit, onError)} />
      </FormProvider>
      <Space height={vs(40)} />
    </CenterView>
  </AppContainer>
}

export { Forgot }
