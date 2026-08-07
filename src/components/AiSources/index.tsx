import React, { memo, useMemo } from 'react'

import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { gray, lightGray } from '../../constants'
import { extractSources } from '../../utils/aiSources'

interface AiSourcesProps {
  text: string
}

export const AiSources = memo(({ text }: AiSourcesProps) => {
  const { t } = useTranslation()
  const sources = useMemo(() => extractSources(text), [text])

  if (sources.length === 0) return null

  return (
    <View style={styles.container}>
      <Text
        h="h9"
        title={t('aiSources.title')}
        textStyle={styles.title}
      />
      <Space height={vs(6)} />
      {sources.map((source, index) => (
        <View key={index} style={styles.sourceCard}>
          <Text
            h="h10"
            title={source.reference}
            textStyle={styles.reference}
          />
          {source.quote && (
            <>
              <Space height={vs(4)} />
              <Text
                h="h11"
                title={`“${source.quote}”`}
                oneColor={gray}
                textStyle={styles.quote}
              />
            </>
          )}
        </View>
      ))}
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
  sourceCard: {
    borderLeftWidth: s(2),
    borderLeftColor: lightGray,
    paddingLeft: s(8),
    marginBottom: vs(8)
  },
  reference: {
    fontWeight: '600'
  },
  quote: {
    fontStyle: 'italic'
  }
})
