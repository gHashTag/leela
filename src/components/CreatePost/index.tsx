import React, { useMemo, useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import { FieldValues, FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import * as yup from 'yup'

import { Button, Input, Space } from '..'
import { Loading } from '../'
import { dimGray, navigate } from '../../constants'
import { startStepTimer } from '../../screens/helper'
import { PostStore } from '../../store'

interface CreatePostT {
  plan: number
}

export const CreatePost: React.FC<CreatePostT> = ({ plan }) => {
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const systemMessage = t('system')

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          text: yup
            .string()
            .trim()
            .min(1, t('validation:fewChars') || '')
            .required(t('validation:requireField') || ''),
        })
        .required(),
    [t],
  )

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    methods.reset()
    startStepTimer()
    const response = await PostStore.createPost({
      text: data.text,
      plan: plan,
      systemMessage,
    })
    // navigate('TAB_BOTTOM_1')
    console.log(response, 'response')
    setLoading(false)
  }

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
  })

  return loading ? (
    <Loading />
  ) : (
    <FormProvider {...methods}>
      <Input
        name="text"
        color={dimGray}
        multiline
        placeholder={t('placeholderReport')}
        additionalStyle={page.input}
      />
      <Space height={20} />
      <Button
        title={t('actions.send')}
        onPress={methods.handleSubmit(handleSubmit, err => console.log(err))}
      />
    </FormProvider>
  )
}

const page = StyleSheet.create({
  input: {
    width: '100%',
    alignItems: 'center',
  },
})
