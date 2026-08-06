import { yupResolver } from '@hookform/resolvers/yup'
import auth from '@react-native-firebase/auth'
import { LEELA_ID } from '@env'
import React, { useMemo, useState } from 'react'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import * as yup from 'yup'

import { Button, Input, Space, Text } from '..'
import { Loading } from '../'
import {
  captureException,
  dimGray,
  generateComment,
  navigate
} from '../../constants'
import { startStepTimer } from '../../screens/helper'
import { PostStore } from '../../store'
import { useRevenueCat } from '../../providers/RevenueCatProvider'
import { streamZaiChat } from '../../utils/aiStream'

interface CreatePostT {
  plan: number
}

export const CreatePost: React.FC<CreatePostT> = ({ plan }) => {
  const [loading, setLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [reasoning, setReasoning] = useState('')
  const [aiContent, setAiContent] = useState('')
  const { t } = useTranslation()
  const { user } = useRevenueCat()
  const systemMessage = t('system')

  const schema = useMemo(
    () =>
      yup
        .object()
        .shape({
          text: yup
            .string()
            .trim()
            .min(100, t('fewChars') || '')
            .required(t('requireField') || '')
        })
        .required(),
    [t]
  )

  const runAiStream = async (reportText: string, postData: any) => {
    const planText = t(`plan_${plan}.content`)
    const messages = [
      {
        role: 'system' as const,
        content: `${systemMessage}\n\n${planText}`
      },
      { role: 'user' as const, content: reportText }
    ]

    setIsStreaming(true)
    setReasoning('')
    setAiContent('')

    try {
      const result = await streamZaiChat(
        {
          messages,
          maxTokens: 6000,
          temperature: 0.1,
          thinking: { type: 'enabled' }
        },
        {
          onReasoning: (_chunk, fullReasoning) => {
            setReasoning(fullReasoning)
          },
          onContent: (_chunk, fullContent) => {
            setAiContent(fullContent)
          }
        }
      )

      let finalContent = result.content
      // If the model spent the whole token budget on reasoning and never
      // produced an answer, fall back to a non-thinking completion so the
      // player always receives a grounded response.
      if (!finalContent.trim()) {
        const fallback = await generateComment({
          message: reportText,
          systemMessage,
          planText,
          pro: user.pro
        })
        finalContent = fallback.response
        setAiContent(finalContent)
      }

      if (finalContent.trim()) {
        await PostStore.createComment({
          text: finalContent,
          postId: postData.id,
          postOwner: postData.ownerId || '',
          ownerId: LEELA_ID
        })
      }

      navigate('TAB_BOTTOM_1')
    } catch (error) {
      captureException(error as Error, 'CreatePost: AI stream')
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
    try {
      setLoading(true)
      methods.reset()
      startStepTimer()
      const createdPost = await PostStore.createPost({
        text: data.text,
        plan: plan,
        systemMessage,
        planText: t(`plan_${plan}.content`),
        pro: user.pro
      })
      setLoading(false)

      if (createdPost?.id) {
        await runAiStream(data.text, createdPost)
      } else {
        navigate('TAB_BOTTOM_1')
      }
    } catch (error) {
      captureException(error as Error, 'CreatePost: handleSubmit')
      setLoading(false)
    }
  }

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  if (loading) {
    return <Loading />
  }

  if (isStreaming) {
    return (
      <View style={styles.streamContainer}>
        <Text h="h6" title={t('leelaReflects') || 'Leela is reflecting…'} />
        <Space height={10} />
        <Text
          h="h7"
          title={reasoning || '…'}
          textStyle={styles.thinkingText}
        />
        {aiContent ? (
          <>
            <Space height={20} />
            <Text h="h6" title={t('leelaAnswer') || "Leela's answer"} />
            <Space height={10} />
            <Text h="h7" title={aiContent} />
          </>
        ) : null}
      </View>
    )
  }

  return (
    <FormProvider {...methods}>
      <Input
        name="text"
        color={dimGray}
        multiline
        placeholder={t('placeholderReport')}
        additionalStyle={styles.input}
      />
      <Space height={20} />
      <Button
        title={t('actions.send')}
        onPress={methods.handleSubmit(handleSubmit, (err) =>
          captureException(err, 'CreatePost: handleSubmit')
        )}
      />
    </FormProvider>
  )
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    alignItems: 'center'
  },
  streamContainer: {
    width: '100%',
    paddingHorizontal: 4
  },
  thinkingText: {
    color: dimGray,
    fontStyle: 'italic'
  }
})
