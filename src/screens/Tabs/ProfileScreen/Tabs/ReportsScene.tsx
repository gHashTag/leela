import React, { useContext, useEffect, useState } from 'react'

import firestore from '@react-native-firebase/firestore'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import { PostCard, SceneStates, Space, Text } from '../../../../components'
import { captureException } from '../../../../constants'
import { useTypedNavigation } from '../../../../hooks'
import { PostStore } from '../../../../store'
import { subscribeTracked } from '../../../../utils/listenerRegistry'
import { getUid } from '../../../helper'
import { TabContext } from '../TabContext'

export const ReportsScene = observer(() => {
  const [limit, setLimit] = useState(15)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()
  const { navigate } = useTypedNavigation()

  const { panGesture0, scrollViewGesture0, blockScrollUntilAtTheTop0 } =
    useContext(TabContext) as any

  const load = () => {
    setError(null)
    return subscribeTracked('ReportsScene', () =>
      firestore()
        .collection('Posts')
        .where('ownerId', '==', getUid())
        .orderBy('createTime', 'desc')
        .limit(limit)
        .onSnapshot(
          (snapshot) => {
            PostStore.fetchOwnPosts(snapshot)
            setRefreshing(false)
          },
          (err) => {
            captureException(err, 'subPosts')
            setError(String(t('online-part.postsLoadError')))
            setRefreshing(false)
          }
        )
    )
  }

  useEffect(() => {
    const dispose = load()
    return () => {
      dispose()
    }
  }, [limit])

  const data = PostStore.store.ownPosts
  const newLimit = () => {
    if (data.length <= limit) {
      setLimit((pr) => pr + 15)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    setLimit(15)
  }

  const state = error
    ? ({ type: 'error', message: error, onRetry: onRefresh } as const)
    : data.length === 0
      ? ({
          type: 'empty',
          title: t('profileEmpty.reportsTitle'),
          message: t('profileEmpty.reportsMessage'),
          icon: '📜',
          action: {
            title: t('profileEmpty.reportsAction'),
            onPress: () => navigate('SELECT_PLAYERS_SCREEN')
          }
        } as const)
      : ({ type: 'ready' } as const)

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop0, panGesture0),
        scrollViewGesture0
      )}
    >
      <SceneStates state={state} refreshing={refreshing} onRefresh={onRefresh}>
        <FlatList
          removeClippedSubviews={false}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          data={data}
          onEndReached={newLimit}
          onEndReachedThreshold={0.1}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <PostCard postId={item.id} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <Space height={vs(10)} />}
          ListHeaderComponent={<Space height={vs(10)} />}
          ListFooterComponent={<Space height={vs(250)} />}
          ListEmptyComponent={
            <View style={styles.noPostBlock}>
              <Text
                textStyle={styles.noPostText}
                h={'h4'}
                title={t('online-part.noPosts')}
              />
            </View>
          }
        />
      </SceneStates>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  noPostBlock: {
    paddingHorizontal: s(10)
  },
  noPostText: {
    textAlign: 'center'
  }
})
