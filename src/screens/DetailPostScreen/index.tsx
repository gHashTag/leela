import { RouteProp, useFocusEffect } from '@react-navigation/native'
import React, { useCallback, useEffect } from 'react'
import { StyleSheet, View, FlatList } from 'react-native'
import {
  CommentCard,
  EmptyComments,
  Header,
  Loading,
  PostCard,
  Space
} from '../../components'
import { captureException, lightGray, paleBlue } from '../../constants'
import { OnlinePlayer, PostStore } from '../../store'
import { PostT, RootStackParamList } from '../../types'

import { s, vs } from 'react-native-size-matters'
import { nanoid } from 'nanoid/non-secure'
import { observer } from 'mobx-react-lite'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getUid } from '../helper'
import firestore from '@react-native-firebase/firestore'
import I18n from 'i18n-js'

interface DetailPostI {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
  route: RouteProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
}

export const DetailPostScreen: React.FC<DetailPostI> = observer(
  ({ navigation, route }) => {
    const { postId, comment, translatedText, hideTranslate } = route.params

    const curItem: PostT | undefined = PostStore.store.posts.find(a => a.id === postId)
    if (!curItem) return <Loading />
    const itemIndex = PostStore.store.posts.findIndex(a => a.id === postId)
    const commentData = PostStore.store.comments.filter(a => a.postId === curItem.id)
    function newComment() {
      curItem &&
        navigation.navigate('INPUT_TEXT_MODAL', {
          onSubmit: text =>
            PostStore.createComment({
              text,
              postId: curItem.id,
              postOwner: curItem.ownerId
            })
        })
    }
    useFocusEffect(
      useCallback(() => {
        if (curItem) {
          const subComments = firestore()
            .collection('Comments')
            .where('postId', '==', curItem.id)
            .onSnapshot(PostStore.fetchComments, err => captureException(err))
          return subComments
        }
      }, [])
    )

    useEffect(() => {
      if (getUid() === undefined) {
        navigation.navigate('WELCOME_SCREEN')
        return
      }
      comment && setTimeout(newComment, 900)
      if (!curItem) {
        PostStore.getOncePost()
        OnlinePlayer.getProfile()
      }
    }, [])

    function GoPostScreen() {
      navigation.canGoBack()
        ? navigation.goBack()
        : navigation.navigate('MAIN', {
            screen: 'TAB_BOTTOM_1',
            params: { scrollToId: itemIndex !== -1 ? itemIndex : 0 }
          })
    }

    return (
      <FlatList
        removeClippedSubviews={false}
        ListHeaderComponent={
          <>
            <Header
              textAlign="center"
              iconLeft=":back:"
              iconRight={null}
              title={I18n.t('post')}
              onPress={GoPostScreen}
            />
            <PostCard
              postId={postId}
              isDetail
              translatedText={translatedText}
              isHideTranslate={hideTranslate}
              onPressCom={newComment}
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
        keyExtractor={a => a.id}
        ListEmptyComponent={<EmptyComments />}
        data={commentData}
        renderItem={({ item, index }) => (
          <CommentCard item={item} index={index} endIndex={commentData.length - 1} />
        )}
      />
    )
  }
)

const style = StyleSheet.create({
  line: {
    width: '100%',
    borderBottomColor: lightGray,
    borderBottomWidth: s(0.5)
  }
})

const { line } = style
