import React, { useState } from 'react'

import { yupResolver } from '@hookform/resolvers/yup'
import { FieldValues, FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import * as yup from 'yup'

import { Button, Input, Space } from '..'
import { Loading } from '../'
import { black, dimGray, navigate } from '../../constants'
import { startStepTimer } from '../../screens/helper'
import { PostStore } from '../../store'
import { I18n } from '../../utils'
interface CreatePostT {
  plan: number
}

const schema = yup
  .object()
  .shape({
    text: yup
      .string()
      .trim()
      .min(100, I18n.t('fewChars'))
      .required(I18n.t('requireField')),
  })
  .required()

export const CreatePost: React.FC<CreatePostT> = ({ plan }) => {
  const [loading, setLoading] = useState(false)

  const handleSubmit: SubmitHandler<FieldValues> = async data => {
    setLoading(true)
    methods.reset()
    startStepTimer()
    await PostStore.createPost({ text: data.text, plan: plan })
    navigate('TAB_BOTTOM_1')
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
        placeholder={I18n.t('placeholderReport')}
        additionalStyle={{ width: '100%', alignItems: 'center' }}
      />
      <Space height={20} />
      <Button
        title={I18n.t('send')}
        onPress={methods.handleSubmit(handleSubmit, err => console.log(err))}
      />
    </FormProvider>
  )
}
