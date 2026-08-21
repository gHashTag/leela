import React, { useCallback, useContext, useEffect, useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import {
  EmptyComments,
  HashtagFormat,
  PlanAvatar,
  SceneStates,
  Space,
  Text
} from '../../../../components'
import { gray, lightGray } from '../../../../constants'
import { useTypedNavigation } from '../../../../hooks'
import { getTimeStamp } from '../../../../screens/helper'
import { TabContext } from '../TabContext'
import {
  CachedAiAnswerT,
  loadCachedAiAnswers
} from '../../../../utils/aiAnswerCache'

export const AiAnswersScene = observer(() => {
  const { t } = useTranslation()
  const { navigate } = useTypedNavigation()
  const { headerGesture } = useContext(TabContext) as any
  const [answers, setAnswers] = useState<CachedAiAnswerT[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setError(null)
    setLoading(true)
    loadCachedAiAnswers()
      .then((data) => {
        setAnswers(data)
        setLoading(false)
      })
      .catch(() => {
        setError(String(t('sceneStates.errorGeneric')))
        setLoading(false)
      })
  }, [t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const state = loading
    ? ({ type: 'loading' } as const)
    : error
      ? ({ type: 'error', message: error, onRetry: refresh } as const)
      : answers.length === 0
        ? ({
            type: 'empty',
            title: t('profileEmpty.aiAnswersTitle'),
            message: t('profileEmpty.aiAnswersMessage'),
            icon: '✨',
            action: {
              title: t('profileEmpty.aiAnswersAction'),
              onPress: () => navigate('SELECT_PLAYERS_SCREEN')
            }
          } as const)
        : ({ type: 'ready' } as const)

  return (
    <GestureDetector gesture={headerGesture}>
      <SceneStates state={state}>
        <View style={styles.container}>
          <FlatList
            removeClippedSubviews={false}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            data={answers}
            keyExtractor={(a) => a.postId}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refresh} />
            }
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
      </SceneStates>
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
