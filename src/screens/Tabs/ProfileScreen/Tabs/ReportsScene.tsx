import { observer } from 'mobx-react'
import React, { useContext, useEffect, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { PostCard, Space, Text } from '../../../../components'
import { PostStore } from '../../../../store'
import { I18n } from '../../../../utils'
import firestore from '@react-native-firebase/firestore'
import { captureException } from '../../../../constants'
import { getUid } from '../../../helper'
import Animated from 'react-native-reanimated'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import { TabContext } from '../TabContext'

export const ReportsScene = observer(() => {
  const [limit, setLimit] = useState(15)

  const { panGesture0, scrollViewGesture0, scrollOffset0, blockScrollUntilAtTheTop0 } =
    useContext(TabContext) as any

  useEffect(() => {
    const subPosts = firestore()
      .collection('Posts')
      .where('ownerId', '==', getUid())
      .orderBy('createTime', 'desc')
      .limit(limit)
      .onSnapshot(PostStore.fetchOwnPosts, captureException)
    return () => {
      subPosts()
    }
  }, [limit])

  const data = PostStore.store.ownPosts

  const newLimit = () => {
    if (data.length <= limit) setLimit(pr => pr + 15)
  }

  return (
    <>
      <GestureDetector
        gesture={Gesture.Simultaneous(
          Gesture.Race(blockScrollUntilAtTheTop0, panGesture0),
          scrollViewGesture0
        )}
      >
        <Animated.ScrollView
          bounces={false}
          scrollEventThrottle={1}
          onScrollBeginDrag={e => {
            scrollOffset0.value = e.nativeEvent.contentOffset.y
          }}
        >
          <ScrollView horizontal={true} contentContainerStyle={scrollViewTrick}>
            <FlatList
              removeClippedSubviews={false}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              data={data}
              onEndReached={newLimit}
              onEndReachedThreshold={0.1}
              keyExtractor={a => a.id}
              renderItem={({ item }) => <PostCard postId={item.id} />}
              ItemSeparatorComponent={() => <Space height={vs(10)} />}
              ListHeaderComponent={<Space height={vs(10)} />}
              ListEmptyComponent={
                <View style={{ paddingHorizontal: s(20) }}>
                  <Text
                    textStyle={{ textAlign: 'center' }}
                    h={'h1'}
                    title={I18n.t('noPosts')}
                  />
                </View>
              }
            />
          </ScrollView>
        </Animated.ScrollView>
      </GestureDetector>
      <Space height={vs(70)} />
    </>
  )
})

const styles = StyleSheet.create({
  scrollViewTrick: {
    width: '100%',
    height: '100%'
  }
})

const { scrollViewTrick } = styles
