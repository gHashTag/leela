import React, { useState, ReactElement } from 'react'
import { Auth } from 'aws-amplify'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp, useTheme } from '@react-navigation/native'
import { AppContainer, Button, Input } from '../../../components'
import { goBack, white, black, captureException } from '../../../constants'
import { RootStackParamList } from '../../../types'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'FORGOT'>
type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'FORGOT'>

type ForgotT = {
  navigation: ProfileScreenNavigationProp
  route: ProfileScreenRouteProp
}

const Forgot = ({ route, navigation }: ForgotT): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const _onPress = async (values: { email: string }): Promise<void> => {
    setLoading(true)
    try {
      const { email } = values
      const user = await Auth.forgotPassword(email)
      user && navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })
      setLoading(false)
    } catch (err) {
      setError(err.message)
      captureException(err.message)
    }
  }

  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <>
      <AppContainer
        backgroundColor={dark ? black : white}
        title=" "
        onPress={goBack(navigation)}
        message={error}
        loading={loading}
        colorLeft={color}
      >
        <Formik
          initialValues={{ email: route.params.email }}
          onSubmit={(values): Promise<void> => _onPress(values)}
          validationSchema={Yup.object().shape({
            email: Yup.string().email().required()
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
              <Button title={I18n.t('confirm')} onPress={handleSubmit} color={color} />
            </>
          )}
        </Formik>
      </AppContainer>
    </>
  )
}

export { Forgot }
