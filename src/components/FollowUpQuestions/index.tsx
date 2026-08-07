import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { navigate, primary } from '../../constants'
import { PostStore } from '../../store'
import { getFollowUpQuestions } from '../../utils/followUpQuestions'

interface FollowUpQuestionsI {
  postId: string
}

export const FollowUpQuestions = memo(({ postId }: FollowUpQuestionsI) => {
  const { t } = useTranslation()
  const questions = getFollowUpQuestions(t)
  const postOwner =
    PostStore.store.posts.find((a) => a.id === postId)?.ownerId ||
    PostStore.store.ownPosts.find((a) => a.id === postId)?.ownerId ||
    ''

  const handlePress = (question: string) => {
    navigate('INPUT_TEXT_MODAL', {
      initialText: question,
      onSubmit: (text: string) =>
        PostStore.createComment({
          text,
          postId,
          postOwner
        })
    })
  }

  return (
    <View style={styles.container}>
      <Text
        h="h9"
        title={t('followUpQuestions.title')}
        textStyle={styles.title}
      />
      <Space height={vs(6)} />
      <View style={styles.chips}>
        {questions.map((question, index) => (
          <Pressable
            key={index}
            onPress={() => handlePress(question)}
            style={styles.chip}
            accessibilityLabel={question}
          >
            <Text h="h11" title={question} oneColor={primary} />
          </Pressable>
        ))}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: vs(8)
  },
  title: {
    fontStyle: 'italic'
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  chip: {
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: primary,
    paddingHorizontal: s(10),
    paddingVertical: vs(4),
    marginRight: s(6),
    marginBottom: vs(6)
  }
})
