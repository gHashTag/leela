import { useCallback, useState } from 'react'

// @ts-expect-error
import { EMAIL, PASSWORD } from '@env'
import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { FieldValues, SubmitErrorHandler, SubmitHandler, useForm } from 'react-hook-form'
import * as Keychain from 'react-native-keychain'
import * as yup from 'yup'

import { captureException } from '../../../constants'
import { useTypedNavigation } from '../../../hooks'
import { I18n } from '../../../utils'

const schema = yup
  .object()
  .shape({
    email: yup
      .string()
      .email(I18n.t('invalidEmail'))
      .trim()
      .required(I18n.t('requireField')),
    password: yup
      .string()
      .required(I18n.t('requireField'))
      .min(6, I18n.t('shortPassword')),
    passwordConfirmation: yup
      .string()
      .required(I18n.t('requireField'))
      .min(6, I18n.t('shortPassword')),
  })
  .required()

const initialValues = {
  email: __DEV__ ? EMAIL : '',
  password: __DEV__ ? PASSWORD : '',
  passwordConfirmation: __DEV__ ? PASSWORD : '',
}

export const useSignUp = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { navigate } = useTypedNavigation()

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues,
  })

  const onSubmit: SubmitHandler<FieldValues> = useCallback(
    async data => {
      const { email, password, passwordConfirmation } = data
      if (password !== passwordConfirmation) {
        setError(I18n.t('passwordsDoNotMatch'))
      } else {
        setLoading(true)
        setError('')
        await auth()
          .createUserWithEmailAndPassword(email, password)
          .then(async () => {
            await Keychain.setInternetCredentials('auth', email, password)
            navigate('CONFIRM_SIGN_UP', { email })
            setLoading(false)
          })
          .catch(error => {
            switch (error.code) {
              case 'auth/invalid-email':
                setError(I18n.t('invalidEmail'))
                break
              case 'auth/email-already-in-use':
                setError(I18n.t('usernameExistsException'))
                break
              case 'auth/wrong-password':
                setError(I18n.t('forgotPassword'))
                break
              case 'auth/network-request-failed':
                setError(I18n.t('networkRequestFailed'))
                break
              case 'auth/too-many-requests':
                setError(I18n.t('manyRequests'))
                break
              default:
                captureException(error.message)
                setError(error.code)
                break
            }
            setLoading(false)
          })
      }
    },
    [navigate],
  )
  return { loading, error, methods, onSubmit }
}
