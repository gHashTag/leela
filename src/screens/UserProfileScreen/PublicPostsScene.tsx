import React, { useContext, useEffect, useState } from 'react'

import firestore from '@react-native-firebase/firestore'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import { PostCard, Space, Text } from '../../components'
import { captureException } from '../../constants'
import { subscribeTracked } from '../../utils/listenerRegistry'
import { TabContext } from '../Tabs/ProfileScreen/TabContext'

interface PublicPostsSceneT {
  ownerId: string
}

export const PublicPostsScene = observer(({ ownerId }: PublicPostsSceneT) => {
  const [limit, setLimit] = useState(15)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  const { panGesture2, scrollViewGesture2, blockScrollUntilAtTheTop2 } =
    useContext(TabContext) as any

  useEffect(() => {
    setLoading(true)
    const dispose = subscribeTracked('PublicPostsScene', () =>
      firestore()
        .collection('Posts')
        .where('ownerId', '==', ownerId)
        .where('accept', '==', true)
        .orderBy('createTime', 'desc')
        .limit(limit)
        .onSnapshot(
          (snap) => {
            const res = (snap?.docs ?? [])
              .map((a) => (a.exists ? a.data() : undefined))
              .filter((a): a is any => a !== undefined)
            setPosts(res.sort((a, b) => b.createTime - a.createTime))
            setLoading(false)
          },
          (error) => {
            captureException(error, 'PublicPostsScene')
            setLoading(false)
          }
        )
    )
    return () => {
      dispose()
    }
  }, [ownerId, limit])

  const newLimit = () => {
    if (posts.length <= limit) {
      setLimit((pr) => pr + 15)
    }
  }

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop2, panGesture2),
        scrollViewGesture2
      )}
    >
      <FlatList
        removeClippedSubviews={false}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        data={posts}
        onEndReached={newLimit}
        onEndReachedThreshold={0.1}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <PostCard postId={item.id} post={item} />}
        ItemSeparatorComponent={() => <Space height={vs(10)} />}
        ListHeaderComponent={<Space height={vs(10)} />}
        ListFooterComponent={<Space height={vs(250)} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.noPostBlock}>
              <Text
                textStyle={styles.noPostText}
                h={'h4'}
                title={t('profile.noPublicPosts')}
              />
            </View>
          )
        }
      />
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
