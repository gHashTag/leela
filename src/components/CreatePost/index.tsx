import { yupResolver } from '@hookform/resolvers/yup'
import AsyncStorage from '@react-native-async-storage/async-storage'
import auth from '@react-native-firebase/auth'
import { LEELA_ID } from '@env'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FieldValues,
  FormProvider,
  SubmitHandler,
  useForm
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, StyleSheet, View } from 'react-native'
import * as yup from 'yup'

import { Button, Input, Space, Text } from '..'
import { Loading } from '../'
import { ButtonVectorIcon } from '../Buttons/ButtonVectorIcon'
import {
  captureException,
  dimGray,
  generateComment,
  navigate,
  primary,
  recordPositiveEvent,
  red
} from '../../constants'
import { useVoiceInput } from '../../hooks'
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

  const { ...methods } = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema)
  })

  const handleVoiceResult = useCallback(
    (value: string) => {
      const current = methods.getValues('text') || ''
      const separator = current.length > 0 && !current.endsWith(' ') ? ' ' : ''
      methods.setValue('text', `${current}${separator}${value}`, {
        shouldValidate: true
      })
    },
    [methods]
  )

  const { isListening, startListening, stopListening } =
    useVoiceInput(handleVoiceResult)

  const [draftLoaded, setDraftLoaded] = useState(false)
  const [stage, setStage] = useState(0)
  const reportText = methods.watch('text')

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('@draftReport')
        if (draft) {
          methods.setValue('text', draft, { shouldValidate: true })
        }
      } catch (error) {
        captureException(error as Error, 'CreatePost: loadDraft')
      } finally {
        setDraftLoaded(true)
      }
    }
    loadDraft()
  }, [methods])

  useEffect(() => {
    if (!draftLoaded) return
    const saveDraft = async () => {
      try {
        if (reportText) {
          await AsyncStorage.setItem('@draftReport', reportText)
        } else {
          await AsyncStorage.removeItem('@draftReport')
        }
      } catch (error) {
        captureException(error as Error, 'CreatePost: saveDraft')
      }
    }
    saveDraft()
  }, [reportText, draftLoaded])

  const showError = (message: string) => {
    Alert.alert(t('error') || 'Error', message, [{ text: 'OK' }])
  }

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
    setStage(0)

    let hasReasoning = false
    let hasContent = false

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
            if (!hasReasoning) {
              hasReasoning = true
              setStage(1)
            }
            setReasoning(fullReasoning)
          },
          onContent: (_chunk, fullContent) => {
            if (!hasContent) {
              hasContent = true
              setStage(2)
            }
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

      await AsyncStorage.removeItem('@draftReport')
      methods.reset()
      await recordPositiveEvent()
      navigate('TAB_BOTTOM_1')
    } catch (error) {
      captureException(error as Error, 'CreatePost: AI stream')
      showError(
        t('aiCommentFailed') ||
          'Leela could not answer this report. You can try sending it again.'
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
    try {
      setLoading(true)
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
        showError(
          t('postCreateFailed') ||
            'The report could not be created. Please try again.'
        )
      }
    } catch (error) {
      captureException(error as Error, 'CreatePost: handleSubmit')
      setLoading(false)
      showError(
        t('postCreateFailed') ||
          'The report could not be created. Please try again.'
      )
    }
  }

  if (!draftLoaded || loading) {
    return <Loading />
  }

  if (isStreaming) {
    return (
      <View style={styles.streamContainer}>
        <Text h="h6" title={t(`pipeline.stage_${stage}`)} />
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
      <View style={styles.voiceRow}>
        <ButtonVectorIcon
          name={isListening ? 'mic' : 'mic-outline'}
          ionicons
          size={24}
          color={isListening ? red : primary}
          onPress={isListening ? stopListening : startListening}
        />
        <Space width={10} />
        <Text
          h="h7"
          title={isListening ? t('voiceInput.listening') : t('voiceInput.hint')}
          textStyle={styles.voiceHint}
        />
      </View>
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
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  voiceHint: {
    color: dimGray
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
