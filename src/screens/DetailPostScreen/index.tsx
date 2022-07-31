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
import { captureException, goBack, lightGray, paleBlue } from '../../constants'
import { OnlinePlayer, PostStore } from '../../store'
import { PostT, RootStackParamList } from '../../types'

import { s, vs } from 'react-native-size-matters'
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
    const commentData = PostStore.store.comments
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
      const handleLink = async () => {
        if (getUid() === undefined) {
          navigation.navigate('WELCOME_SCREEN')
          return
        }
        comment && setTimeout(newComment, 900)
        if (!curItem) {
          await PostStore.getOncePost()
          await OnlinePlayer.getProfile()
        }
      }
      handleLink()
    }, [])

    if (!curItem) return <Loading />
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
              onPress={navigation.goBack}
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
