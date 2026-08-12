import auth from '@react-native-firebase/auth'
import { nanoid } from 'nanoid/non-secure'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonVectorIcon } from '../Buttons'
import { primary, white } from '../../constants'
import { OnlinePlayer, PostStore } from '../../store'
import { CommentT } from '../../types/types'
import { triggerHaptic } from '../../utils/haptics'

interface InlineCommentInputT {
  postId: string
  postOwner: string
}

export const InlineCommentInput: React.FC<InlineCommentInputT> = ({
  postId,
  postOwner
}) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const submit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 2 || sending) return

    const user = auth().currentUser
    if (!user?.uid) return

    triggerHaptic('impactMedium')
    setSending(true)

    const id = nanoid(22)
    const optimistic: CommentT = {
      id,
      text: trimmed,
      postId,
      postOwner,
      ownerId: user.uid,
      firstName: OnlinePlayer.store.profile.firstName,
      lastName: OnlinePlayer.store.profile.lastName,
      email: user.email || '',
      createTime: Date.now(),
      reply: false,
      pending: true
    }

    PostStore.addOptimisticComment(optimistic)
    setText('')

    try {
      await PostStore.createComment({
        id,
        text: trimmed,
        postId,
        postOwner
      })
    } catch (error) {
      PostStore.removeOptimisticComment(id)
    } finally {
      setSending(false)
    }
  }, [text, sending, postId, postOwner])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('online-part.uComment')}
          placeholderTextColor="#888"
          style={styles.input}
          maxLength={250}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
          accessibilityLabel={t('accessibility.commentInput')}
          testID="inline-comment-input"
        />
        <ButtonVectorIcon
          ionicons
          name="send-outline"
          size={s(22)}
          color={text.trim().length >= 2 ? primary : '#888'}
          onPress={submit}
          accessibilityLabel={t('accessibility.sendComment')}
          testID="inline-comment-send"
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    backgroundColor: white,
    paddingHorizontal: s(12),
    paddingVertical: vs(8)
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: vs(44)
  },
  input: {
    flex: 1,
    maxHeight: vs(100),
    paddingVertical: vs(8),
    paddingHorizontal: s(12),
    marginRight: s(8),
    borderRadius: s(20),
    backgroundColor: '#F5F5F5',
    color: '#1c1c1c',
    fontSize: s(14)
  }
})
