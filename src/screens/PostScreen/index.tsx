import React, { useState, useCallback, useEffect } from 'react'
import { Header, PostCard, Space, Txt } from '../../components'
import { goBack } from '../../constants'
import { OnlinePlayerStore, PostStore } from '../../store'
import { StackNavigationProp } from '@react-navigation/stack'
import { PostT, RootStackParamList } from '../../types'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { FlatList } from 'react-native-gesture-handler'
import { View } from 'react-native'
import { observer } from 'mobx-react-lite'
import { vs } from 'react-native-size-matters'

interface Ichat {
  navigation: StackNavigationProp<RootStackParamList, 'POST_SCREEN'>
}

const PostScreen: React.FC<Ichat> = observer(({ navigation }) => {

  useEffect(() => {
    const subscriber = firestore().collection('Posts')
      .onSnapshot(PostStore.fetchPosts, (err) => console.log(err))
    return () => subscriber()
  }, [])

  return <>
    <Header iconLeft=':back:' onPress={goBack(navigation)} />
    <FlatList
      data={PostStore.store.posts}
      keyExtractor={a => a.id}
      renderItem={({ item, index }) => <PostCard item={item} index={index} />}
      ItemSeparatorComponent={() => <Space height={vs(10)} />}
      ListHeaderComponent={<>
        <Space height={vs(5)} />
        <Txt h10 title='Plans report' />
        <Space height={vs(10)} />
      </>}
      ListEmptyComponent={<View>
        <Txt h2 title='No posts yet. Make a move so you can post' />
      </View>}
    />
  </>
})

export { PostScreen }
