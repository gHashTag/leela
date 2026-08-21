import React, { useCallback, useEffect, useRef, useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Vibration,
  View
} from 'react-native'
import { Bubble, GiftedChat, IMessage } from 'react-native-gifted-chat'
import { s } from 'react-native-size-matters'
import {
  ButtonVectorIcon,
  ButtonWithIcon,
  ChatStarterPrompts,
  Header,
  Space,
  Text
} from '../../../components'
import {
  brightTurquoise,
  captureException,
  onLeaveFeedback,
  trueBlue
} from '../../../constants'
import { DiceStore, actionsDice } from '../../../store'
import { useRevenueCat } from '../../../providers/RevenueCatProvider'
import { streamZaiChat } from '../../../utils/aiStream'
import { buildSystemMessage, loadAiPersona } from '../../../utils/aiPersona'

const LEELA_AI = require('../../../../assets/defaultImage/leelaAI.jpg')

interface IContextSummary {
  user: string[]
  assistant: string[]
}

const CITATION_REGEX = [
  /Bhagavad Gita \d+\.\d+/gi,
  /Бхагавад-гита \d+\.\d+/gi,
  /Chandogya Upanishad \d+\.\d+(?:\.\d+)?/gi,
  /Чандогья-упанишада \d+\.\d+(?:\.\d+)?/gi,
  /Brihadaranyaka Upanishad \d+\.\d+(?:\.\d+)?/gi,
  /Katha Upanishad \d+\.\d+(?:\.\d+)?/gi,
  /Mundaka Upanishad \d+\.\d+(?:\.\d+)?/gi,
  /Yoga Sutras \d+\.\d+/gi,
  /Йога-сутры \d+\.\d+/gi,
  /Shiva Sutras \d+\.\d+/gi,
  /Vedanta Sutras \d+\.\d+(?:\.\d+)?/gi
]

const SOURCES_REGEX = /(?:Sources|Источники)[\s:—–-]+(.+?)(?:\n|$)/is

const extractCitations = (text: string): string[] => {
  const found = new Set<string>()
  CITATION_REGEX.forEach((re) =>
    text.match(re)?.forEach((match) => found.add(match))
  )
  const sourcesMatch = text.match(SOURCES_REGEX)
  if (sourcesMatch) {
    sourcesMatch[1]
      .split(/[,;•·]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => found.add(s))
  }
  return Array.from(found).slice(0, 6)
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
  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [inputText, setInputText] = useState('')

  const listRef = useRef<FlatList<IMessage> | null>(null)
  const scrollOffsetRef = useRef(0)
  const contentHeightRef = useRef(0)
  const layoutHeightRef = useRef(0)

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

    const persona = await loadAiPersona()
    const apiMessages = [
      {
        role: 'system',
        content: buildSystemMessage(t, persona)
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
            setMessages((previousMessages) => removeLoading(previousMessages))
            captureException(error, 'ChatScreen: streamZaiChat')
          }
        }
      )
    } catch (error) {
      captureException(error as Error, 'ChatScreen: onSend')
      Alert.alert(
        t('error') || 'Error',
        t('aiMessageFailed') || 'Leela could not answer. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setLoading(false)
      setMessages((previousMessages) => removeLoading(previousMessages))
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

  const handleCopyAnswer = useCallback(
    async (messageId: string | number, text: string) => {
      if (!text) return
      try {
        await Clipboard.setString(text)
        Vibration.vibrate(20)
        setCopiedId(messageId)
        setTimeout(() => setCopiedId(null), 2000)
      } catch (error) {
        captureException(error, 'ChatScreen: copyAnswer')
      }
    },
    []
  )

  // @ts-expect-error
  const renderBubble = (props) => {
    const isAssistant = props.position === 'left'
    const citations = isAssistant
      ? extractCitations(props.currentMessage.text || '')
      : []

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

    const isCopied = copiedId === props.currentMessage._id

    return (
      <View style={styles.bubbleWrapper}>
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
        {citations.length > 0 && (
          <View
            style={[
              styles.citationsRow,
              isAssistant ? { marginLeft: s(8) } : { marginRight: s(8) }
            ]}
          >
            {citations.map((citation) => (
              <View key={citation} style={styles.citationChip}>
                <Text h="h11" title={citation} oneColor="#50E3C2" />
              </View>
            ))}
          </View>
        )}
        {isAssistant && (
          <View
            style={[
              styles.copyRow,
              props.position === 'left'
                ? { marginLeft: s(8) }
                : { marginRight: s(8) }
            ]}
          >
            <ButtonVectorIcon
              ionicons
              name={isCopied ? 'checkmark-outline' : 'copy-outline'}
              size={s(12)}
              color={isCopied ? '#50E3C2' : undefined}
              onPress={() =>
                handleCopyAnswer(
                  props.currentMessage._id,
                  props.currentMessage.text || ''
                )
              }
            />
            {isCopied && (
              <Text
                h="h11"
                textStyle={styles.copyLabel}
                title={t('copied') || 'Copied'}
              />
            )}
          </View>
        )}
      </View>
    )
  }

  const messagesCount = messages.length
  const showStarters = messagesCount === 1

  const handleStarterPrompt = useCallback((prompt: string) => {
    setInputText(prompt)
  }, [])

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({
      offset: contentHeightRef.current,
      animated: true
    })
    setShowScrollToBottom(false)
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // The current chat session is kept in local state. A future backend-backed
    // history fetch can replace this timeout with a real reload.
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const handleScroll = useCallback((event) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y
    layoutHeightRef.current = event.nativeEvent.layoutMeasurement.height
    contentHeightRef.current = event.nativeEvent.contentSize.height
    updateScrollButtonVisibility()
  }, [])

  const updateScrollButtonVisibility = useCallback(() => {
    const nearBottom =
      contentHeightRef.current -
        (scrollOffsetRef.current + layoutHeightRef.current) <
      s(80)
    setShowScrollToBottom(!nearBottom)
  }, [])

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height
      updateScrollButtonVisibility()
    },
    [updateScrollButtonVisibility]
  )

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.user._id === 2) {
      // New assistant message arrived; auto-scroll only if user is already near bottom.
      const nearBottom =
        contentHeightRef.current -
          (scrollOffsetRef.current + layoutHeightRef.current) <
        s(120)
      if (nearBottom) {
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true })
        }, 100)
      } else {
        setShowScrollToBottom(true)
      }
    }
  }, [messages])

  const renderChatFooter = useCallback(() => {
    return (
      <ChatStarterPrompts
        visible={showStarters}
        onSelect={handleStarterPrompt}
      />
    )
  }, [showStarters, handleStarterPrompt])

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
      <View style={styles.chatContainer}>
        <GiftedChat
          messages={messages}
          renderBubble={renderBubble}
          onSend={(newMessages) => onSend(newMessages)}
          user={{
            _id: 1
          }}
          text={inputText}
          onInputTextChanged={setInputText}
          renderChatFooter={renderChatFooter}
          listViewProps={{
            ref: listRef,
            onScroll: handleScroll,
            onContentSizeChange: handleContentSizeChange,
            refreshing,
            onRefresh
          }}
        />
        {showScrollToBottom && (
          <View style={styles.scrollButtonContainer}>
            <ButtonVectorIcon
              ionicons
              name="chevron-down-circle-outline"
              size={s(24)}
              color={brightTurquoise}
              onPress={scrollToBottom}
            />
          </View>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  chatContainer: {
    flex: 1
  },
  bubble: {
    padding: 10,
    top: 1,
    alignItems: 'center'
  },
  bubbleWrapper: {
    flexDirection: 'column'
  },
  citationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: s(4),
    maxWidth: '80%'
  },
  citationChip: {
    backgroundColor: 'rgba(80, 227, 194, 0.2)',
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.5)',
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    margin: s(2)
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(4),
    maxWidth: '80%'
  },
  copyLabel: {
    marginLeft: s(6),
    color: '#50E3C2'
  },
  feadbackContainer: {
    alignSelf: 'center'
  },
  scrollButtonContainer: {
    position: 'absolute',
    bottom: s(80),
    right: s(16),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: s(20),
    padding: s(6)
  }
})

export { ChatScreen }
