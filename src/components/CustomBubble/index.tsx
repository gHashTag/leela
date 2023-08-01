import React from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { BubbleProps, IMessage } from 'react-native-gifted-chat'
import { Text } from '../TextComponents'
import { brightTurquoise, lightGray } from '../../constants'

const LOADING_MESSAGE_ID = 'loading'

interface CustomBubbleProps extends BubbleProps<IMessage> {
  loading: boolean
}

const CustomBubble = ({ currentMessage, user, loading }: CustomBubbleProps) => {
  const isCurrentUser =
    currentMessage && user && currentMessage.user._id === user._id

  if (currentMessage && currentMessage._id === LOADING_MESSAGE_ID) {
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
    <View
      style={[
        styles.bubbleContainer,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}
    >
      <Text h={'h4'} title={currentMessage?.text ?? ''} />
    </View>
  )
}

const styles = StyleSheet.create({
  bubbleContainer: {
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
    maxWidth: '80%'
  },
  currentUserBubble: {
    alignSelf: 'flex-end',
    backgroundColor: brightTurquoise
  },
  otherUserBubble: {
    alignSelf: 'flex-start',
    backgroundColor: lightGray
  },
  bubble: {
    padding: 10,
    top: 1,
    alignItems: 'center'
  }
})

export { CustomBubble }
