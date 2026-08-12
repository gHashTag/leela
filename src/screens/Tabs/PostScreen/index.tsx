import React, { useCallback, useEffect, useRef, useState } from 'react'

import firestore, {
  FirebaseFirestoreTypes
} from '@react-native-firebase/firestore'
import { RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  Button,
  FeedFilter,
  Header,
  PostCard,
  PostsSkeleton,
  Space,
  Text
} from '../../../components'
import { captureException, openUrl } from '../../../constants'
import { lang } from '../../../i18n'
import { DiceStore, OnlinePlayer, PostStore } from '../../../store'
import { RootTabParamList } from '../../../types/types'
import {
  filterPosts,
  PostFeedFilter
} from '../../../utils/postFeedFilter'
import { subscribeTracked } from '../../../utils/listenerRegistry'
import { getUid } from '../../helper'

interface Ipost {
  navigation: NativeStackNavigationProp<RootTabParamList, 'TAB_BOTTOM_1'>
  route: RouteProp<RootTabParamList, 'TAB_BOTTOM_1'>
}

const isIndexError = (error: FirebaseFirestoreTypes.NativeError) => {
  if (!error) return false
  const code = (error as any)?.code
  const message = (error as Error)?.message || ''
  return (
    code === 'firestore/failed-precondition' ||
    message.toLowerCase().includes('requires an index')
  )
}

export const PostScreen = observer(({ navigation }: Ipost) => {
  const [limit, setLimit] = useState(15)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [feedFilter, setFeedFilter] = useState<PostFeedFilter>('newest')

  const { t } = useTranslation()
  const isAdmin = OnlinePlayer.store.status === 'Admin'
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const onRetry = useCallback(() => {
    setLoadError('')
    setRetryKey((k) => k + 1)
  }, [])

  const onReportBug = useCallback(() => {
    const subject = encodeURIComponent(
      t('online-part.bugReportSubject') || 'Leela bug report'
    )
    const body = encodeURIComponent(
      `${t('online-part.postsLoadError') || 'Feed error'}: ${loadError}`
    )
    openUrl(`mailto:reactnativeinitru@gmail.com?subject=${subject}&body=${body}`)
  }, [loadError, t])

  useEffect(() => {
    if (!DiceStore.online) return

    const buildQuery = (withLanguageFilter: boolean) => {
      let query = firestore()
        .collection('Posts')
        .orderBy('createTime', 'desc')
        .limit(limit)

      if (!isAdmin && withLanguageFilter) {
        query = query.where('language', '==', lang)
      }
      return query
    }

    const subscribe = (withLanguageFilter: boolean) => {
      return subscribeTracked('PostScreen', () =>
        buildQuery(withLanguageFilter).onSnapshot(
          (snap) => {
            PostStore.fetchPosts(snap, withLanguageFilter ? undefined : lang)
            setLoadError('')
            setRefreshing(false)
          },
          (err) => {
            if (withLanguageFilter && isIndexError(err)) {
              // Firestore lacks the composite index for language + createTime.
              // Tear down the failing listener and fall back to an unfiltered
              // query, then apply the language filter in memory so the feed
              // still works while the index is being created.
              unsubscribeRef.current?.()
              unsubscribeRef.current = subscribe(false)
              return
            }
            captureException(err, 'PostScreen: subscription')
            setLoadError(String(t('online-part.postsLoadError')))
            setRefreshing(false)
          }
        )
      )
    }

    unsubscribeRef.current = subscribe(true)

    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [limit, isAdmin, retryKey])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setLimit((prev) => prev + 15)
  }, [])

  const rawData = PostStore.store.posts
  const uid = getUid()
  const data = filterPosts(rawData, feedFilter, uid)
  const newLimit = () => {
    if (data.length <= limit) {
      setLimit((pr) => pr + 15)
    }
  }
  const load = PostStore.store.loadPosts && data.length === 0 && !loadError

  return load ? (
    <>
      <Header textAlign="center" title={t('online-part.reports')} />
      <PostsSkeleton count={4} />
    </>
  ) : (
    <FlatList
      removeClippedSubviews={true}
      maxToRenderPerBatch={8}
      windowSize={5}
      initialNumToRender={8}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onScrollToIndexFailed={(error) =>
        captureException(error, 'PostScreen: Flatlist')
      }
      showsVerticalScrollIndicator={false}
      data={data}
      onEndReached={newLimit}
      onEndReachedThreshold={0.1}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <PostCard postId={item.id} />}
      ItemSeparatorComponent={() => <Space height={vs(10)} />}
      ListHeaderComponent={
        <>
          <Header textAlign="center" title={t('online-part.reports')} />
          <FeedFilter selected={feedFilter} onSelect={setFeedFilter} />
          <Space height={vs(10)} />
        </>
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: s(20), alignItems: 'center' }}>
          {loadError ? (
            <>
              <Text
                textStyle={styles.noPostText}
                h={'h4'}
                title={loadError}
              />
              <Space height={vs(20)} />
              <Button onPress={onRetry} title={t('online-part.retry')} />
              <Space height={vs(12)} />
              <Button onPress={onReportBug} title={t('online-part.reportBug')} />
            </>
          ) : (
            <>
              <Text h="h0" title="🪷" textStyle={styles.emptyIcon} />
              <Space height={vs(12)} />
              <Text
                textStyle={styles.noPostText}
                h={'h4'}
                title={
                  feedFilter === 'myPosts'
                    ? t('online-part.noPostsFiltered')
                    : t('online-part.noPostsHeadline')
                }
              />
              <Space height={vs(16)} />
              <Text
                h={'h6'}
                textStyle={styles.hintText}
                title={t('online-part.makeReport')}
              />
              <Space height={vs(20)} />
              <Button
                onPress={() => navigation.navigate('TAB_BOTTOM_0')}
                title={t('online-part.goToGame')}
              />
            </>
          )}
        </View>
      }
    />
  )
})

const styles = StyleSheet.create({
  noPostText: {
    textAlign: 'center'
  },
  hintText: {
    textAlign: 'center',
    opacity: 0.7
  },
  emptyIcon: {
    textAlign: 'center'
  }
})
