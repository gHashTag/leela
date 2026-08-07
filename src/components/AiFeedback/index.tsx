import React, { memo, useEffect, useState } from 'react'

import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Text } from '../'
import { gray, lightGray } from '../../constants'
import { AiFeedback, loadAiFeedback, saveAiFeedback } from '../../utils/aiFeedback'

interface AiFeedbackI {
  postId: string
}

export const AiFeedbackButtons = memo(({ postId }: AiFeedbackI) => {
  const [feedback, setFeedback] = useState<AiFeedback>(null)

  useEffect(() => {
    let mounted = true
    loadAiFeedback(postId).then((value) => {
      if (mounted) setFeedback(value)
    })
    return () => {
      mounted = false
    }
  }, [postId])

  const handlePress = async (value: AiFeedback) => {
    const next = feedback === value ? null : value
    setFeedback(next)
    await saveAiFeedback(postId, next)
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => handlePress('up')}
        style={styles.button}
        accessibilityLabel="Thumbs up"
        accessibilityRole="button"
        accessibilityState={{ selected: feedback === 'up' }}
      >
        <Text
          h="h7"
          title={feedback === 'up' ? '👍' : '👍🏻'}
          textStyle={[
            styles.icon,
            feedback === 'up' ? styles.active : styles.inactive
          ]}
        />
      </Pressable>
      <Pressable
        onPress={() => handlePress('down')}
        style={styles.button}
        accessibilityLabel="Thumbs down"
        accessibilityRole="button"
        accessibilityState={{ selected: feedback === 'down' }}
      >
        <Text
          h="h7"
          title={feedback === 'down' ? '👎' : '👎🏻'}
          textStyle={[
            styles.icon,
            feedback === 'down' ? styles.active : styles.inactive
          ]}
        />
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4)
  },
  button: {
    paddingHorizontal: s(6),
    paddingVertical: vs(2)
  },
  icon: {
    fontSize: s(18)
  },
  active: {
    opacity: 1
  },
  inactive: {
    opacity: 0.55
  }
})
