import React, { useContext, useEffect, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { EmptyComments, HashtagFormat, PlanAvatar, Space, Text } from '../../../../components'
import { gray, lightGray } from '../../../../constants'
import { getTimeStamp } from '../../../../screens/helper'
import { TabContext } from '../TabContext'
import {
  CachedAiAnswerT,
  loadCachedAiAnswers
} from '../../../../utils/aiAnswerCache'

export const AiAnswersScene = observer(() => {
  const { t } = useTranslation()
  const { headerGesture } = useContext(TabContext) as any
  const [answers, setAnswers] = useState<CachedAiAnswerT[]>([])

  useEffect(() => {
    let mounted = true
    loadCachedAiAnswers().then((data) => {
      if (mounted) setAnswers(data)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <GestureDetector gesture={headerGesture}>
      <View style={styles.container}>
        <FlatList
          removeClippedSubviews={false}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          data={answers}
          keyExtractor={(a) => a.postId}
          ListEmptyComponent={<EmptyComments />}
          ItemSeparatorComponent={() => <Space height={vs(10)} />}
          ListHeaderComponent={<Space height={vs(10)} />}
          ListFooterComponent={<Space height={vs(250)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.header}>
                <PlanAvatar plan={item.plan} size="medium" />
                <Space width={s(8)} />
                <View>
                  <Text
                    h="h6"
                    title={t('aiAnswers.title', { plan: item.plan })}
                  />
                  <Text
                    h="h11"
                    colors={{ light: lightGray, dark: gray }}
                    title={getTimeStamp({ lastTime: item.timestamp })}
                  />
                </View>
              </View>
              <Space height={vs(8)} />
              <HashtagFormat h="h6" title={item.text} selectable />
            </View>
          )}
        />
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  card: {
    paddingHorizontal: s(12),
    paddingVertical: vs(8)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
  }
})
