import { useCallback, useMemo, useRef, useState } from 'react'

// @ts-expect-error
import { EMAIL, PASSWORD } from '@env'
import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as Keychain from 'react-native-keychain'
import * as yup from 'yup'

import { captureException } from '../../../constants'
import { onSignIn } from '../../helper'

const initialValues = { email: __DEV__ ? EMAIL : '', password: __DEV__ ? PASSWORD : '' }

export const useSignIn = () => {
  const userInfo = useRef('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>('')
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
            .required(t('requireField') || ''),
          password: yup
            .string()
            .required(t('requireField') || '')
            .min(6, t('shortPassword') || ''),
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
      userInfo.current = data.email
      setLoading(true)
      setError('')
      const { email, password } = data
      await auth()
        .signInWithEmailAndPassword(email, password)
        .then(async user => {
          await Keychain.setInternetCredentials('auth', email, password)
          await onSignIn(user.user)
        })
        .catch(err => {
          switch (err.code) {
            case 'auth/invalid-email':
              setError(t('invalidEmail'))
              break
            case 'auth/user-not-found':
              setError(t('userNotFound'))
              break
            case 'auth/wrong-password':
              setError(t('auth.forgotPassword'))
              break
            case 'auth/network-request-failed':
              setError(t('networkRequestFailed'))
              break
            case 'auth/too-many-requests':
              setError(t('manyRequests'))
              break
            default:
              captureException(err.message, 'onSubmit')
              setError(err.code)
              break
          }
        })
      setLoading(false)
    },
    [t],
  )

  return { onSubmit, methods, error: error || '', loading, userInfo }
}
