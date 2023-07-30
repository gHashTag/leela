import React, { useContext, useEffect, useState } from 'react'

import firestore from '@react-native-firebase/firestore'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import { PostCard, Space, Text } from '../../../../components'
import { captureException } from '../../../../constants'
import { PostStore } from '../../../../store'
import { getUid } from '../../../helper'
import { TabContext } from '../TabContext'

export const ReportsScene = observer(() => {
  const [limit, setLimit] = useState(15)
  const { t } = useTranslation()

  const { panGesture0, scrollViewGesture0, blockScrollUntilAtTheTop0 } =
    useContext(TabContext) as any

  useEffect(() => {
    const subPosts = firestore()
      .collection('Posts')
      .where('ownerId', '==', getUid())
      .orderBy('createTime', 'desc')
      .limit(limit)
      .onSnapshot(PostStore.fetchOwnPosts, (error) =>
        captureException(error, 'subPosts')
      )
    return () => {
      subPosts()
    }
  }, [limit])

  const data = PostStore.store.ownPosts
  const newLimit = () => {
    if (data.length <= limit) {
      setLimit((pr) => pr + 15)
    }
  }

  return (
    <GestureDetector
      gesture={Gesture.Simultaneous(
        Gesture.Race(blockScrollUntilAtTheTop0, panGesture0),
        scrollViewGesture0
      )}
    >
      <FlatList
        removeClippedSubviews={false}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        data={data}
        onEndReached={newLimit}
        onEndReachedThreshold={0.1}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <PostCard postId={item.id} />}
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
