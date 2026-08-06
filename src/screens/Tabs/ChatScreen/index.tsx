import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View
} from 'react-native'
import { Bubble, GiftedChat, IMessage } from 'react-native-gifted-chat'
import { s } from 'react-native-size-matters'
import { ButtonWithIcon, Header, Space } from '../../../components'
import { brightTurquoise, captureException, onLeaveFeedback, trueBlue } from '../../../constants'
import { DiceStore, actionsDice } from '../../../store'
import { useRevenueCat } from '../../../providers/RevenueCatProvider'
import { streamZaiChat } from '../../../utils/aiStream'

const LEELA_AI = require('../../../../assets/defaultImage/leelaAI.jpg')

interface IContextSummary {
  user: string[]
  assistant: string[]
}

const LOADING_MESSAGE_ID = 'loading-message-id'

const ChatScreen: React.FC = () => {
  const { user } = useRevenueCat()
  const [messages, setMessages] = useState<IMessage[]>([])
  const [contextSummary, setContextSummary] = useState<IContextSummary>({
    user: [],
    assistant: []
  })
  const [loading, setLoading] = useState(false)

  const { t } = useTranslation()

  const updateContextSummary = (message: IMessage) => {
    const messageLimit = -5
    if (message.user._id === 1) {
      setContextSummary((prevState) => {
        const newUserMessages = [...prevState.user, message.text].slice(
          messageLimit
        )
        return { ...prevState, user: newUserMessages }
      })
    } else {
      setContextSummary((prevState) => {
        const newAssistantMessages = [
          ...prevState.assistant,
          message.text
        ].slice(messageLimit)
        return { ...prevState, assistant: newAssistantMessages }
      })
    }
  }

  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: t('assistant'),
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Assistant',
          avatar: LEELA_AI
        }
      }
    ])
  }, [t])

  const onSend = async (newMessages: IMessage[] = []) => {
    setLoading(true)
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, newMessages)
    )

    updateContextSummary(newMessages[0])

    const apiMessages = [
      {
        role: 'system',
        content: t('system')
      },
      ...contextSummary.user.map((content) => ({ role: 'user', content })),
      ...contextSummary.assistant.map((content) => ({
        role: 'assistant',
        content
      })),
      { role: 'user', content: newMessages[0].text }
    ]

    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, [
        {
          _id: LOADING_MESSAGE_ID,
          text: '',
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Assistant',
            avatar: LEELA_AI
          }
        }
      ])
    )

    const reasoningId = `reasoning-${Date.now()}`
    const contentId = `content-${Date.now()}`
    let finalAssistantContent = ''

    const removeLoading = (messages: IMessage[]) =>
      messages.filter((message) => message._id !== LOADING_MESSAGE_ID)

    try {
      await streamZaiChat(
        {
          messages: apiMessages,
          maxTokens: 4000,
          temperature: 0.1,
          thinking: { type: 'enabled' }
        },
        {
          onReasoning: (chunk, fullReasoning) => {
            setLoading(false)
            setMessages((previousMessages) => {
              const cleaned = removeLoading(previousMessages)
              const reasoningMessage = cleaned.find(
                (message) => message._id === reasoningId
              )
              if (!reasoningMessage) {
                return GiftedChat.append(cleaned, [
                  {
                    _id: reasoningId,
                    text: fullReasoning,
                    createdAt: new Date(),
                    user: {
                      _id: 2,
                      name: 'Assistant (thinking)',
                      avatar: LEELA_AI
                    }
                  }
                ])
              }
              return cleaned.map((message) =>
                message._id === reasoningId
                  ? { ...message, text: fullReasoning }
                  : message
              )
            })
          },
          onContent: (chunk, fullContent) => {
            setLoading(false)
            finalAssistantContent = fullContent
            setMessages((previousMessages) => {
              const cleaned = removeLoading(previousMessages)
              const contentMessage = cleaned.find(
                (message) => message._id === contentId
              )
              if (!contentMessage) {
                return GiftedChat.append(cleaned, [
                  {
                    _id: contentId,
                    text: fullContent,
                    createdAt: new Date(),
                    user: {
                      _id: 2,
                      name: 'Assistant',
                      avatar: LEELA_AI
                    }
                  }
                ])
              }
              return cleaned.map((message) =>
                message._id === contentId
                  ? { ...message, text: fullContent }
                  : message
              )
            })
          },
          onError: (error) => {
            setLoading(false)
            setMessages((previousMessages) =>
              removeLoading(previousMessages)
            )
            captureException(error, 'ChatScreen: streamZaiChat')
          }
        }
      )
    } catch (error) {
      captureException(error as Error, 'ChatScreen: onSend')
      Alert.alert(
        t('error') || 'Error',
        t('aiMessageFailed') ||
          'Leela could not answer. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setLoading(false)
      setMessages((previousMessages) =>
        removeLoading(previousMessages)
      )
    }

    if (finalAssistantContent) {
      updateContextSummary({
        _id: 2,
        text: finalAssistantContent,
        createdAt: new Date(),
        user: { _id: 2, name: 'Assistant', avatar: LEELA_AI }
      } as IMessage)
    }
  }

  const onPressRate = () => {
    onLeaveFeedback((success) => actionsDice.setRate(success))
  }
  // @ts-expect-error
  const renderBubble = (props) => {
    if (props.currentMessage._id === LOADING_MESSAGE_ID) {
      return (
        <View>
          {loading ? (
            <View style={styles.bubble}>
              <ActivityIndicator size="small" color={brightTurquoise} />
            </View>
          ) : null}
        </View>
      )
    }

    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: { backgroundColor: `${brightTurquoise}` }
        }}
        textStyle={{
          left: { fontFamily: 'Montserrat' },
          right: { color: '#000', fontFamily: 'Montserrat' }
        }}
      />
    )
  }

  const messagesCount = messages.length

  return (
    <>
      <Header title="Leela AI" textAlign="center" />
      {DiceStore.rate && messagesCount === 7 ? (
        <View>
          <ButtonWithIcon
            viewStyle={styles.feadbackContainer}
            h="h5"
            color={trueBlue}
            title={t('actions.leaveFeedback')}
            onPress={onPressRate}
          />
          <Space height={s(7)} />
        </View>
      ) : null}
      <GiftedChat
        messages={messages}
        renderBubble={renderBubble}
        onSend={(newMessages) => onSend(newMessages)}
        user={{
          _id: 1
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  bubble: {
    padding: 10,
    top: 1,
    alignItems: 'center'
  },
  feadbackContainer: {
    alignSelf: 'center'
  }
})

export { ChatScreen }
