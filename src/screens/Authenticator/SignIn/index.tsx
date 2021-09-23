import React, { useState, ReactElement } from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { Auth } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { I18n } from '../../../utils'
import { s } from 'react-native-size-matters'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Button, Space, ButtonLink, TextError, Input } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SIGN_IN'>

type SignUpT = {
  navigation: ProfileScreenNavigationProp
}

const SignIn = ({ navigation }: SignUpT): ReactElement => {
  const [userInfo, setUserInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const _onPress = async (values: { email: string; password: string }): Promise<void> => {
    setUserInfo(values.email)
    setLoading(true)
    setError('')
    try {
      const { email, password } = values
      const user = await Auth.signIn(email, password)
      await Keychain.setInternetCredentials('auth', email, password)
      user && navigation.navigate('MAIN')
      setLoading(false)
    } catch (err) {
      captureException(err.message)
      setLoading(false)
      if (err.code === 'UserNotConfirmedException') {
        setError(I18n.t('accountNotVerifiedYet'))
      } else if (err.code === 'PasswordResetRequiredException') {
        setError(I18n.t('resetYourPassword'))
      } else if (err.code === 'NotAuthorizedException') {
        setError(I18n.t('forgotPassword'))
      } else if (err.code === 'UserNotFoundException') {
        setError(I18n.t('userDoesNotExist'))
      } else {
        setError(err.code)
      }
    }
  }

  const { dark } = useTheme()
  const color = dark ? white : black
  // initialValues={{ email: 'reactnativeinitru@gmail.com', password: 'qwerty123' }}
  return (
    <AppContainer
      backgroundColor={dark ? black : white}
      onPress={goBack(navigation)}
      title=" "
      loading={loading}
      colorLeft={color}
    >
      <Formik
        initialValues={{ email: '', password: '' }}
        onSubmit={(values): Promise<void> => _onPress(values)}
        validationSchema={Yup.object().shape({
          email: Yup.string().email().required(),
          password: Yup.string().min(6).required()
        })}
      >
        {({ values, handleChange, errors, setFieldTouched, touched, handleSubmit }): ReactElement => (
          <KeyboardAvoidingView behavior="padding">
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
            <Button title={I18n.t('signIn')} onPress={handleSubmit} color={color} />
          </KeyboardAvoidingView>
        )}
      </Formik>
    </AppContainer>
  )
}

export { SignIn }
