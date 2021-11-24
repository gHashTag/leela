import React, { useState, ReactElement } from 'react'
import { Auth } from 'aws-amplify'
import { Formik } from 'formik'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import * as Yup from 'yup'
import { AppContainer, Button, Space, ButtonLink, TextError, Input } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CONFIRM_SIGN_UP'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'CONFIRM_SIGN_UP'>

type ConfirmSignUpT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const ConfirmSignUp = ({ route, navigation }: ConfirmSignUpT): ReactElement => {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const _onPress = async (values: { code: string }): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { code } = values
      const { email, password } = route.params
      await Auth.confirmSignUp(email, code, { forceAliasCreation: true })
      const user = await Auth.signIn(email, password)
      user && navigation.navigate('SIGN_UP_USERNAME', route.params)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      if (err.code === 'CodeMismatchException') {
        setError(I18n.t('invalidVerificationCode'))
      } else {
        setError(err.message)
        captureException(err.message)
      }
    }
  }

  const _onResend = async (): Promise<void> => {
    try {
      const { email } = route.params
      await Auth.resendSignUp(email)
    } catch (err) {
      captureException(err.message)
      setError(err.message)
    }
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer
      backgroundColor={dark ? black : white}
      title=" "
      onPress={goBack(navigation)}
      loading={loading}
      colorLeft={color}
    >
      <Formik
        initialValues={{ code: '' }}
        onSubmit={(values): Promise<void> => _onPress(values)}
        validationSchema={Yup.object().shape({
          code: Yup.string().min(6).required()
        })}
      >
        {({ values, handleChange, errors, setFieldTouched, touched, handleSubmit }): ReactElement => (
          <>
            <Input
              name="code"
              value={values.code}
              onChangeText={handleChange('code')}
              onBlur={(): void => setFieldTouched('code')}
              placeholder={I18n.t('insertCode')}
              touched={touched}
              errors={errors}
              color={color}
            />
            <ButtonLink title={I18n.t('resendCode')} onPress={_onResend} textStyle={{ alignSelf: 'center' }} />
            {error !== '' && <TextError title={error} />}
            <Space height={50} />
            <Button title={I18n.t('confirm')} onPress={handleSubmit} color={color} />
            <Space height={50} />
          </>
        )}
      </Formik>
    </AppContainer>
  )
}

export { ConfirmSignUp }
