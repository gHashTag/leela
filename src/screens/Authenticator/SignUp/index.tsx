import React, { useState, ReactElement } from 'react'
import { Auth } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Space, Button, Input, TextError } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_UP'>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const SignUp = ({ navigation }: SignUpT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const _onPress = async (values: { email: string; password: string; passwordConfirmation: string }): Promise<void> => {
    const { email, password, passwordConfirmation } = values
    if (password !== passwordConfirmation) {
      setError(I18n.t('passwordsDoNotMatch'))
    } else {
      setLoading(true)
      setError('')
      try {
        const user = await Auth.signUp(email, password)
        await Keychain.setInternetCredentials('auth', email, password)
        user && navigation.navigate('CONFIRM_SIGN_UP', { email, password })
        setLoading(false)
      } catch (err) {
        setLoading(false)
        captureException(err.message)
        if (err.code === 'UserNotConfirmedException') {
          setError(I18n.t('accountNotVerifiedYet'))
        } else if (err.code === 'PasswordResetRequiredException') {
          setError(I18n.t('resetYourPassword'))
        } else if (err.code === 'UsernameExistsException') {
          setError(I18n.t('usernameExistsException'))
        } else if (err.code === 'NotAuthorizedException') {
          setError(I18n.t('forgotPassword'))
        } else if (err.code === 'UserNotFoundException') {
          setError(I18n.t('userDoesNotExist'))
        } else {
          setError(err.code)
        }
      }
    }
  }

  const { dark } = useTheme()
  const color = dark ? white : black
  // initialValues={{
  //   email: 'reactnativeinitru@gmail.com',
  //   password: 'qwerty123',
  //   passwordConfirmation: 'qwerty123'
  // }}
  return (
    <AppContainer
      backgroundColor={dark ? black : white}
      onPress={goBack(navigation)}
      title=" "
      loading={loading}
      colorLeft={color}
    >
      <Formik
        initialValues={{
          email: '',
          password: '',
          passwordConfirmation: ''
        }}
        onSubmit={(values): Promise<void> => _onPress(values)}
        validationSchema={Yup.object().shape({
          email: Yup.string().email().required(),
          password: Yup.string().min(6).required(),
          passwordConfirmation: Yup.string().min(6).required()
        })}
      >
        {({ values, handleChange, errors, setFieldTouched, touched, handleSubmit }): ReactElement => (
          <>
            <Input
              name="email"
              value={values.email}
              onChangeText={handleChange('email')}
              onBlur={(): void => setFieldTouched('email')}
              placeholder="E-mail"
              touched={touched}
              errors={errors}
              autoCapitalize="none"
              color={color}
            />
            <Input
              name="password"
              value={values.password}
              onChangeText={handleChange('password')}
              onBlur={(): void => setFieldTouched('password')}
              placeholder={I18n.t('password')}
              touched={touched}
              errors={errors}
              secureTextEntry
              color={color}
            />
            <Input
              name="passwordConfirmation"
              value={values.passwordConfirmation}
              onChangeText={handleChange('passwordConfirmation')}
              onBlur={(): void => setFieldTouched('passwordConfirmation')}
              placeholder={I18n.t('passwordConfirmation')}
              touched={touched}
              errors={errors}
              secureTextEntry
              color={color}
            />
            <Space height={30} />
            {error !== '' && <TextError title={error} textStyle={{ alignSelf: 'center' }} />}
            <Space height={20} />
            <Button title={I18n.t('signUp')} onPress={handleSubmit} color={color} />
            <Space height={50} />
          </>
        )}
      </Formik>
    </AppContainer>
  )
}

export { SignUp }
