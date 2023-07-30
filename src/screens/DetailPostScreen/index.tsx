import React, { useCallback, useEffect } from 'react'

import firestore from '@react-native-firebase/firestore'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import {
  CommentCard,
  EmptyComments,
  Header,
  Loading,
  PostCard,
  Space
} from '../../components'
import { captureException, lightGray } from '../../constants'
import { OnlinePlayer, PostStore } from '../../store'
import { PostT, RootStackParamList } from '../../types'
import { getUid } from '../helper'

interface DetailPostI {
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    'DETAIL_POST_SCREEN'
  >
  route: RouteProp<RootStackParamList, 'DETAIL_POST_SCREEN'>
}

export const DetailPostScreen: React.FC<DetailPostI> = observer(
  ({ navigation, route }) => {
    const { postId, comment, translatedText, hideTranslate } = route.params

    const curItem: PostT | undefined = PostStore.store.posts.find(
      (a) => a.id === postId
    )
    const commentData = PostStore.store.comments.filter(
      (a) => a.postId === curItem?.id
    )

    const newComment = useCallback(() => {
      if (curItem) {
        navigation.navigate('INPUT_TEXT_MODAL', {
          onSubmit: (text) =>
            PostStore.createComment({
              text,
              postId: curItem.id,
              postOwner: curItem.ownerId
            })
        })
      }
    }, [curItem, navigation])

    const { t } = useTranslation()
    useFocusEffect(
      useCallback(() => {
        if (curItem) {
          const subComments = firestore()
            .collection('Comments')
            .where('postId', '==', curItem.id)
            .onSnapshot(PostStore.fetchComments, (err) =>
              captureException(err, 'DetailPostScreen')
            )
          return subComments
        }
      }, [curItem])
    )

    useEffect(() => {
      const handleLink = async () => {
        if (getUid() === undefined) {
          navigation.navigate('HELLO')
          return
        }
        comment && setTimeout(newComment, 900)
        if (!curItem) {
          await OnlinePlayer.getProfile()
          await PostStore.getOncePost()
        }
      }
      handleLink()
    }, [comment, curItem, navigation, newComment])

    if (!curItem) {
      return <Loading />
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
              title={t('online-part.report')}
              onPress={navigation.goBack}
            />
            <PostCard
              postId={postId}
              isDetail
              translatedText={translatedText}
              isHideTranslate={hideTranslate}
              onPressCom={newComment}
            />
            <View style={page.line} />
          </>
        }
        ListFooterComponent={
          <>
            <View style={page.line} />
            <Space height={vs(30)} />
          </>
        }
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<EmptyComments />}
        data={commentData}
        renderItem={({ item, index }) => (
          <CommentCard
            item={item}
            index={index}
            endIndex={commentData.length - 1}
          />
        )}
      />
    )
  }
)

const page = StyleSheet.create({
  line: {
    width: '100%',
    borderBottomColor: lightGray,
    borderBottomWidth: s(0.5)
  }
})
