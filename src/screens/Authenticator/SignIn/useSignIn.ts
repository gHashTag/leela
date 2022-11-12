import { useCallback, useRef, useState } from 'react'

import { EMAIL, PASSWORD } from '@env'
import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form'
import * as Keychain from 'react-native-keychain'

// @ts-expect-error
import * as yup from 'yup'

import { captureException } from '../../../constants'
import { I18n } from '../../../utils'
import { onSignIn } from '../../helper'

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
  })
  .required()

const initialValues = { email: __DEV__ ? EMAIL : '', password: __DEV__ ? PASSWORD : '' }

export const useSignIn = () => {
  const userInfo = useRef('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: initialValues,
  })

  const onSubmit: SubmitHandler<FieldValues> = useCallback(async data => {
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
            setError(I18n.t('invalidEmail'))
            break
          case 'auth/user-not-found':
            setError(I18n.t('userNotFound'))
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
            captureException(err.message)
            setError(err.code)
            break
        }
      })
    setLoading(false)
  }, [])

  return { onSubmit, methods, error, loading, userInfo }
}
