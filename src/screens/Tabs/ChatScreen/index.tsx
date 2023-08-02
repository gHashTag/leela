// @ts-expect-error
import { OPEN_AI_KEY } from '@env'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Bubble, GiftedChat, IMessage } from 'react-native-gifted-chat'
import { s } from 'react-native-size-matters'
import { ButtonWithIcon, Header, Space } from '../../../components'
import { brightTurquoise, onLeaveFeedback, trueBlue } from '../../../constants'
import { DiceStore, actionsDice } from '../../../store'

const LEELA_AI = require('../../../../assets/defaultImage/leelaAI.jpg')

interface IContextSummary {
  user: string[]
  assistant: string[]
}

const LOADING_MESSAGE_ID = 'loading-message-id'

const ChatScreen: React.FC = () => {
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

    // Запрос к OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-0314',
        messages: apiMessages,
        max_tokens: 1000,
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${OPEN_AI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    setLoading(false)

    setMessages((previousMessages) =>
      previousMessages.filter((message) => message._id !== LOADING_MESSAGE_ID)
    )

    const assistantReply = response.data.choices[0].message.content

    const loadingMessageId = Date.now().toString()

    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, [
        {
          _id: loadingMessageId,
          text: assistantReply,
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Assistant',
            avatar: LEELA_AI
          }
        }
      ])
    )
  }

  const onPressRate = () => {
    onLeaveFeedback((success) => actionsDice.setRate(success))
  }

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
