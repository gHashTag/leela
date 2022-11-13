import { useCallback, useMemo, useState } from 'react'

// @ts-expect-error
import { EMAIL, PASSWORD } from '@env'
import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as Keychain from 'react-native-keychain'
import * as yup from 'yup'

import { captureException } from '../../../constants'
import { useTypedNavigation } from '../../../hooks'

const initialValues = {
  email: __DEV__ ? EMAIL : '',
  password: __DEV__ ? PASSWORD : '',
  passwordConfirmation: __DEV__ ? PASSWORD : '',
}

export const useSignUp = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>('')
  const { navigate } = useTypedNavigation()
  const { t } = useTranslation()

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          email: yup
            .string()
            .email(t('validation:invalidEmail') || '')
            .trim()
            .required(t('validation:requireField') || ''),
          password: yup
            .string()
            .required(t('validation:requireField') || '')
            .min(6, t('validation:shortPassword') || ''),
          passwordConfirmation: yup
            .string()
            .required(t('validation:requireField') || '')
            .min(6, t('validation:shortPassword') || ''),
        })
        .required(),
    [t],
  )

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues,
  })

  const onSubmit: SubmitHandler<FieldValues> = useCallback(
    async data => {
      const { email, password, passwordConfirmation } = data
      if (password !== passwordConfirmation) {
        setError(t('validation:passwordsDoNotMatch'))
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
          .catch(exception => {
            switch (exception.code) {
              case 'auth/invalid-email':
                setError(t('validation:invalidEmail'))
                break
              case 'auth/email-already-in-use':
                setError(t('validation:userNameExistsException'))
                break
              case 'auth/wrong-password':
                setError(t('auth.forgotPassword'))
                break
              case 'auth/network-request-failed':
                setError(t('validation:networkRequestFailed'))
                break
              case 'auth/too-many-requests':
                setError(t('validation:manyRequests'))
                break
              default:
                captureException(exception.message)
                setError(exception.code)
                break
            }
            setLoading(false)
          })
      }
    },
    [navigate, t],
  )
  return { loading, error: error || '', methods, onSubmit }
}
