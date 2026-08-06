import React, { useCallback, useEffect } from 'react'

import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { nanoid } from 'nanoid/non-secure'
import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { Alert, FlatList, StyleSheet, View } from 'react-native'
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
import { CommentT, PostT, RootStackParamList } from '../../types/types'
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
          onSubmit: async (text) => {
            const user = auth().currentUser
            if (!user?.uid) return

            const id = nanoid(22)
            const optimistic: CommentT = {
              id,
              text,
              postId: curItem.id,
              postOwner: curItem.ownerId,
              ownerId: user.uid,
              firstName: OnlinePlayer.store.profile.firstName,
              lastName: OnlinePlayer.store.profile.lastName,
              email: user.email || '',
              createTime: Date.now(),
              reply: false,
              pending: true
            }

            PostStore.addOptimisticComment(optimistic)

            try {
              await PostStore.createComment({
                id,
                text,
                postId: curItem.id,
                postOwner: curItem.ownerId
              })
            } catch (error) {
              PostStore.removeOptimisticComment(id)
              Alert.alert(
                t('error') || 'Error',
                t('online-part.commentFailed') ||
                  'Could not send the comment. Please try again.'
              )
            }
          }
        })
      }
    }, [curItem, navigation, t])

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
          </>
        }
        ListFooterComponent={
          <>
            <View style={styles.line} />
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

const styles = StyleSheet.create({
  line: {
    width: '100%',
    borderBottomColor: lightGray,
    borderBottomWidth: s(0.5)
  }
})
