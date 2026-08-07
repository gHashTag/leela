import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { vs } from 'react-native-size-matters'

import { HashtagFormat } from '../TextComponents/HashtagFormat'
import { Text } from '../TextComponents/Text'
import { Space } from '../Space'
import { brightTurquoise } from '../../constants'
import {
  loadSimplifiedAnswer,
  saveSimplifiedAnswer,
  simplifyAnswer,
  SIMPLIFY_MIN_LENGTH
} from '../../utils/aiSimplify'

interface SimplifyAnswerProps {
  postId: string
  text: string
  displayText: string
  isAi: boolean
}

export const SimplifyAnswer: React.FC<SimplifyAnswerProps> = ({
  postId,
  text,
  displayText,
  isAi
}) => {
  const { t } = useTranslation()
  const [simplified, setSimplified] = useState<string | null>(null)
  const [showSimplified, setShowSimplified] = useState(false)
  const [loading, setLoading] = useState(false)

  const enabled = isAi && text.length >= SIMPLIFY_MIN_LENGTH

  useEffect(() => {
    if (!enabled) return
    let mounted = true
    loadSimplifiedAnswer(postId).then((stored) => {
      if (!mounted || !stored) return
      setSimplified(stored)
    })
    return () => {
      mounted = false
    }
  }, [enabled, postId])

  if (!enabled) {
    return <HashtagFormat h="h6" title={displayText} selectable />
  }

  const toggle = async () => {
    if (simplified) {
      setShowSimplified((prev) => !prev)
      return
    }
    setLoading(true)
    const result = await simplifyAnswer(text)
    setLoading(false)
    if (result) {
      await saveSimplifiedAnswer(postId, result)
      setSimplified(result)
      setShowSimplified(true)
    }
  }

  return (
    <View>
      {!showSimplified ? (
        <HashtagFormat h="h6" title={displayText} selectable />
      ) : (
        <>
          <Text h="h6" title={simplified ?? displayText} selectable />
          <Space height={vs(6)} />
          <Text
            h="h10"
            title={t('aiSimplify.showOriginal')}
            oneColor={brightTurquoise}
            onPress={() => setShowSimplified(false)}
          />
        </>
      )}
      {!showSimplified && (
        <>
          <Space height={vs(6)} />
          {loading ? (
            <ActivityIndicator size="small" color={brightTurquoise} />
          ) : (
            <Text
              h="h10"
              title={t('aiSimplify.simplify')}
              oneColor={brightTurquoise}
              onPress={toggle}
            />
          )}
        </>
      )}
    </View>
  )
}
