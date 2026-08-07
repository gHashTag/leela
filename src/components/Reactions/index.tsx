import React, { memo, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Text } from '../'
import { lightGray, primary } from '../../constants'
import {
  loadReaction,
  ReactionType,
  REACTIONS,
  saveReaction
} from '../../utils/reactions'

interface ReactionsProps {
  postId: string
  commentId?: string
}

const reactionLabels: Record<ReactionType, string> = {
  '🙏': 'reactions.praying',
  '❤️': 'reactions.heart',
  '🔥': 'reactions.fire'
}

export const Reactions = memo(({ postId, commentId }: ReactionsProps) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<ReactionType | null>(null)

  useEffect(() => {
    let mounted = true
    loadReaction(postId, commentId).then((value) => {
      if (mounted) setSelected(value)
    })
    return () => {
      mounted = false
    }
  }, [postId, commentId])

  const handlePress = async (reaction: ReactionType) => {
    const next = selected === reaction ? null : reaction
    setSelected(next)
    await saveReaction(postId, next, commentId)
  }

  return (
    <View style={styles.container}>
      {REACTIONS.map((reaction) => {
        const isActive = selected === reaction
        return (
          <Pressable
            key={reaction}
            style={[styles.reaction, isActive && styles.activeReaction]}
            onPress={() => handlePress(reaction)}
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(reactionLabels[reaction])}
          >
            <Text h="h7" title={reaction} />
          </Pressable>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6)
  },
  reaction: {
    paddingHorizontal: s(8),
    paddingVertical: vs(3),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: lightGray,
    marginRight: s(8)
  },
  activeReaction: {
    borderColor: primary,
    backgroundColor: `${primary}15`
  }
})
