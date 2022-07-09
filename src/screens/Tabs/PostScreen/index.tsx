import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Header, PostCard, Space, Spin, Text } from '../../../components'
import { DiceStore, PostStore } from '../../../store'
import { RootTabParamList } from '../../../types'
import firestore from '@react-native-firebase/firestore'
import { FlatList } from 'react-native-gesture-handler'
import { View } from 'react-native'
import { observer } from 'mobx-react-lite'
import { s, vs } from 'react-native-size-matters'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { captureException } from '../../../constants'
import I18n from 'i18n-js'

interface Ipost {
  navigation: NativeStackNavigationProp<RootTabParamList, 'TAB_BOTTOM_1'>
  route: RouteProp<RootTabParamList, 'TAB_BOTTOM_1'>
}

const PostScreen: React.FC<Ipost> = observer(({ navigation, route }) => {
  const listRef = useRef<any>()
  const scrollToId = route.params?.scrollToId
  const [limit, setLimit] = useState(10)

  useFocusEffect(() => {
    if (scrollToId) {
      listRef.current?.scrollToIndex({
        animated: true,
        index: scrollToId
      })
    }
  })

  useEffect(() => {
    if (DiceStore.online) {
      const subPosts = firestore()
        .collection('Posts')
        .orderBy('createTime', 'desc')
        .limit(limit)
        .onSnapshot(PostStore.fetchPosts, err => captureException(err))
      return () => {
        subPosts()
      }
    }
  }, [limit])

  const newLimit = () => {
    setLimit(pr => pr + 10)
  }
  const load = PostStore.store.loadPosts && PostStore.store.posts.length === 0
  return load ? (
    <Spin centered />
  ) : (
    <FlatList
      removeClippedSubviews={false}
      ref={listRef}
      onScrollToIndexFailed={er => console.log(er)}
      showsVerticalScrollIndicator={false}
      data={PostStore.store.posts}
      onEndReached={newLimit}
      onEndReachedThreshold={0.1}
      keyExtractor={a => a.id}
      renderItem={({ item, index }) => <PostCard index={index} postId={item.id} />}
      ItemSeparatorComponent={() => <Space height={vs(10)} />}
      ListHeaderComponent={
        <>
          <Header textAlign="center" title={I18n.t('posts')} />
          <Space height={vs(10)} />
        </>
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: s(20) }}>
          <Text textStyle={{ textAlign: 'center' }} h={'h1'} title={I18n.t('noPosts')} />
        </View>
      }
    />
  )
})

export { PostScreen }
