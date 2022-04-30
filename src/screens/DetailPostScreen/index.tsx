import { RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import React, { useState } from 'react'
import { StyleSheet, View, FlatList } from 'react-native'
import {
  CommentCard,
  CreateComment,
  Header,
  Input,
  PostCard,
  Space,
  Text
} from '../../components'
import {
  black,
  brightTurquoise,
  fuchsia,
  goBack,
  gray,
  lightGray,
  paleBlue,
  secondary
} from '../../constants'
import { PostStore } from '../../store'
import { RootStackParamList } from '../../types'

import { s, vs } from 'react-native-size-matters'
import { nanoid } from 'nanoid/non-secure'
import { observer } from 'mobx-react-lite'

interface DetailPostI {
  navigation: StackNavigationProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
  route: RouteProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
}

export const DetailPostScreen: React.FC<DetailPostI> = observer(
  ({ navigation, route }) => {
    const [inputVisible, setInputVisible] = useState(false)
    const { item, index } = route.params

    const data = PostStore.store.comments.filter(a => a.postId === item.id)

    return (
      <>
        <FlatList
          removeClippedSubviews={false}
          ListHeaderComponent={
            <>
              <Header iconLeft=":back:" onPress={goBack(navigation)} />
              <PostCard
                item={item}
                index={index}
                isDetail
                onPressCom={() => setInputVisible(true)}
              />
              <View style={line} />
            </>
          }
          ListFooterComponent={
            <>
              <View style={line} />
              <Space height={vs(30)} />
            </>
          }
          keyExtractor={() => nanoid(9)}
          ListEmptyComponent={
            <View style={dotContainer}>
              <View style={dot} />
              <View style={dot} />
              <View style={[dot, { height: s(22), width: s(22) }]} />
              <View style={dot} />
              <View style={dot} />
            </View>
          }
          data={data}
          renderItem={({ item, index }) => (
            <CommentCard item={item} index={index} endIndex={data.length - 1} />
          )}
        />
        <CreateComment
          postId={item.id}
          postOwner={item.ownerId}
          visible={inputVisible}
          setVisible={setInputVisible}
        />
      </>
    )
  }
)

const style = StyleSheet.create({
  line: {
    width: '100%',
    borderBottomColor: lightGray,
    borderBottomWidth: vs(1)
  },
  dot: {
    height: s(18),
    width: s(18),
    borderRadius: s(22),
    backgroundColor: paleBlue,
    margin: s(8)
  },
  dotContainer: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(20),
    marginBottom: vs(10)
  }
})

const { dot, dotContainer, line } = style
