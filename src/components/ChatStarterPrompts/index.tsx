import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import {
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { Pressable } from '../Pressable'
import { triggerHaptic } from '../../utils/haptics'

interface ChatStarterPromptsT {
  onSelect: (prompt: string) => void
  visible?: boolean
}

export const ChatStarterPrompts = memo(({ onSelect, visible = true }: ChatStarterPromptsT) => {
  const { t } = useTranslation()

  const prompts = [
    t('chatStarters.explainPlane'),
    t('chatStarters.arrowsSnakes'),
    t('chatStarters.dailyIntention'),
    t('chatStarters.goalOfLeela')
  ]

  if (!visible) return null

  return (
    <View style={styles.container} testID="chat-starter-prompts">
      <Text
        h="h6"
        title={t('chatStarters.title')}
        textStyle={styles.title}
      />
      <Space height={vs(12)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {prompts.map((prompt, index) => (
          <Pressable
            key={index}
            onPress={() => {
              triggerHaptic('impactLight')
              onSelect(prompt)
            }}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={t('chatStarters.chipLabel', { prompt })}
            testID={`chat-starter-prompt-${index}`}
          >
            <Text h="h10" title={prompt} textStyle={styles.chipText} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: s(16),
    paddingVertical: vs(12)
  },
  title: {
    textAlign: 'center',
    opacity: 0.7
  },
  scroll: {
    paddingRight: s(16)
  },
  chip: {
    backgroundColor: 'rgba(80, 227, 194, 0.15)',
    borderRadius: s(20),
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.4)',
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    marginRight: s(8)
  },
  chipText: {
    color: '#50E3C2'
  }
})
