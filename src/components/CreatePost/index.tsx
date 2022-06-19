import React, { useState } from 'react'

import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Button, Input, Space } from '..'
import { black, dimGray, navigate } from '../../constants'
import { PostStore } from '../../store'
import I18n from 'i18n-js'
import { Loading } from '../'
import { StyleSheet, View } from 'react-native'
import { vs } from 'react-native-size-matters'
import { startStepTimer } from '../../screens/helper'

interface CreatePostT {
  plan: number
}

const schema = yup
  .object()
  .shape({
    text: yup
      .string()
      .trim()
      .min(100, I18n.t('fewCharacters'))
      .required(I18n.t('requireField'))
  })
  .required()

export const CreatePost: React.FC<CreatePostT> = ({ plan }) => {
  const [loading, setLoading] = useState(false)

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    methods.reset()
    startStepTimer()
    await PostStore.createPost({ text: data.text, plan: plan })
    navigate('TAB_BOTTOM_3')
    setLoading(false)
  }

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  return loading ? (
    <Loading />
  ) : (
    <FormProvider {...methods}>
      <Input
        name="text"
        color={dimGray}
        multiline
        placeholder={I18n.t('placeholderReport')}
        additionalStyle={{ width: '100%', alignItems: 'center' }}
      />
      <Space height={20} />
      <Button
        title={I18n.t('confirm')}
        onPress={methods.handleSubmit(handleSubmit, err => console.log(err))}
      />
    </FormProvider>
  )
}
