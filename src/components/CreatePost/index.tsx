import { yupResolver } from '@hookform/resolvers/yup'
import AsyncStorage from '@react-native-async-storage/async-storage'
import auth from '@react-native-firebase/auth'
import NetInfo from '@react-native-community/netinfo'
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
import {
  buildQueuedPost,
  enqueuePost
} from '../../utils/offlinePostQueue'
import { streamZaiChat } from '../../utils/aiStream'
import { buildSystemMessage, loadAiPersona } from '../../utils/aiPersona'
import { buildAiSystemMessage } from '../../utils/aiLanguage'
import { plainThinking } from '../../utils/plainThinking'

interface CreatePostT {
  plan: number
}

export const CreatePost: React.FC<CreatePostT> = ({ plan }) => {
  const [loading, setLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [reasoning, setReasoning] = useState('')
  const [aiContent, setAiContent] = useState('')
  const { t, i18n } = useTranslation()
  const { user } = useRevenueCat()
  const [systemMessage, setSystemMessage] = useState(t('system'))

  useEffect(() => {
    loadAiPersona().then((persona) => {
      setSystemMessage(buildSystemMessage(t, persona))
    })
  }, [t])

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
    const fullSystemMessage = await buildAiSystemMessage(
      systemMessage,
      planText,
      i18n.language
    )
    const messages = [
      {
        role: 'system' as const,
        content: fullSystemMessage
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

      const netInfo = await NetInfo.fetch()
      if (netInfo.isConnected === false) {
        const queued = await buildQueuedPost({
          text: data.text,
          plan,
          systemMessage,
          planText: t(`plan_${plan}.content`),
          pro: user.pro
        })
        if (queued) {
          await enqueuePost(queued)
          await AsyncStorage.removeItem('@draftReport')
          methods.reset()
          navigate('TAB_BOTTOM_1')
          Alert.alert(
            t('offlineQueue.title') || 'Offline',
            t('offlineQueue.saved') ||
              'No connection. Your report is saved and will be sent automatically when you are back online.',
            [{ text: 'OK' }]
          )
          return
        }
      }

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
        <Space height={12} />
        {/* Thinking is scaffolding, not the answer: a muted card so the reply
            below reads as the thing that matters. The model emits markdown,
            which landed on screen as literal ** and * because nothing renders
            it here - stripped rather than parsed, since this text is discarded
            the moment the answer arrives. */}
        <View style={styles.thinkingCard}>
          <Text
            h="h7"
            title={plainThinking(reasoning) || '…'}
            textStyle={styles.thinkingText}
          />
        </View>
        {aiContent ? (
          <>
            <Space height={20} />
            <Text h="h6" title={t('leelaAnswer') || "Leela's answer"} />
            <Space height={8} />
            <Text h="h7" title={aiContent} textStyle={styles.answerText} />
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
        onPress={methods.handleSubmit(handleSubmit, (err) => {
          // The error branch only reported to the logger, so a rejected report
          // looked exactly like a dead button: press, nothing, no clue. The
          // rule it usually trips is the 100-character minimum.
          captureException(err, 'CreatePost: handleSubmit')
          const message =
            (err?.text?.message as string) ||
            t('fewChars') ||
            'The report cannot be sent yet.'
          showError(message)
        })}
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
  // A quiet container, so the reasoning reads as scaffolding beside the answer
  // rather than competing with it.
  thinkingCard: {
    backgroundColor: 'rgba(80, 227, 194, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(80, 227, 194, 0.5)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  thinkingText: {
    color: dimGray,
    fontStyle: 'italic',
    lineHeight: 20
  },
  answerText: {
    lineHeight: 22
  }
})
