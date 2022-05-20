import { makeAutoObservable } from 'mobx'
import {
  FormPostT,
  PostT,
  CommentT,
  FormCommentT,
  FormReplyCom,
  ReplyComT
} from '../types'
import auth from '@react-native-firebase/auth'
import firestore, {
  FirebaseFirestoreTypes
} from '@react-native-firebase/firestore'
import { nanoid } from 'nanoid/non-secure'
import { OnlinePlayer } from './OnlinePlayer'
import { OtherPlayers } from './OtherPlayers'
import * as Keychain from 'react-native-keychain'
import { getProfile } from '../screens/helper'
import I18n from 'i18n-js'

type fetchT =
  FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
interface postStoreT {
  posts: PostT[]
  comments: CommentT[]
  replyComments: ReplyComT[]
  loadPosts: boolean
}

interface delCommentT {
  commentId: string
  isReply: boolean
}

export const PostStore = {
  store: makeAutoObservable<postStoreT>({
    posts: [],
    comments: [],
    replyComments: [],
    loadPosts: true
  }),
  createPost: async ({ text, plan }: FormPostT) => {
    const userUid = auth().currentUser?.uid
    const email = auth().currentUser?.email
    if (userUid && email) {
      const id = nanoid()
      const post: PostT = {
        text,
        plan,
        ownerId: userUid,
        id,
        createTime: Date.now(),
        email,
        liked: []
      }
      await firestore().collection('Posts').doc(id).set(post)
    }
  },
  createComment: async ({ text, postId, postOwner }: FormCommentT) => {
    const userUid = auth().currentUser?.uid
    const email = auth().currentUser?.email
    const path = nanoid(22)
    if (userUid && email) {
      const comment: CommentT = {
        text,
        postId,
        postOwner,
        firstName: OnlinePlayer.store.profile.firstName,
        lastName: OnlinePlayer.store.profile.lastName,
        ownerId: userUid,
        createTime: Date.now(),
        email,
        reply: false,
        id: path
      }
      await firestore().collection('Comments').doc(path).set(comment)
    }
  },
  delComment: async ({ commentId, isReply }: delCommentT) => {
    await firestore().collection('Comments').doc(commentId).delete()
    PostStore.store.comments = PostStore.store.comments.filter(
      a => a.id !== commentId
    )
    if (!isReply)
      firestore()
        .collection('Comments')
        .where('commentId', '==', commentId)
        .get()
        .then(function (querySnap) {
          querySnap.forEach(function (doc) {
            doc.ref.delete()
          })
        })
  },
  replyComment: async ({ text, commentId, commentOwner }: FormReplyCom) => {
    const userUid = auth().currentUser?.uid
    const prof = await getProfile()
    if (prof) {
      const path = nanoid(23)
      if (userUid) {
        const comment: ReplyComT = {
          text,
          commentId,
          commentOwner,
          firstName: prof.firstName,
          lastName: prof.lastName,
          ownerId: userUid,
          createTime: Date.now(),
          email: prof.email,
          reply: true,
          id: path
        }
        await firestore().collection('Comments').doc(path).set(comment)
      }
    }
  },
  fetchPosts: async (querySnap: fetchT) => {
    PostStore.store.loadPosts = true
    const res: any[] = await Promise.all(
      querySnap.docs
        .map(async a => {
          if (a.exists) {
            const data = a.data()
            return data
          }
        })
        .filter((a: any) => a !== undefined)
    )
    if (res.length > 0) {
      PostStore.store.posts = res.sort((a, b) => b.createTime - a.createTime)
    }
    PostStore.store.loadPosts = false
  },
  fetchComments: async (querySnap: fetchT) => {
    const res: any[] = await Promise.all(
      querySnap.docs
        .map(async a => {
          if (a.exists) {
            const data = a.data()
            return data
          }
        })
        .filter((a: any) => a !== undefined)
      // (a !== undefined ? (a.reply ? false : true) : false)
    )
    if (res.length > 0) {
      PostStore.store.comments = res
        .filter(a => (a.reply ? false : true))
        .sort((a, b) => b.createTime - a.createTime)
      PostStore.store.replyComments = res
        .filter(a => (a.reply ? true : false))
        .sort((a, b) => a.createTime - b.createTime)
    }
  },
  likePost: async (postId: string) => {
    const userUid = auth().currentUser?.uid
    await firestore()
      .collection('Posts')
      .doc(postId)
      .update({
        liked: firestore.FieldValue.arrayUnion(userUid)
      })
  },
  getOwnerName: (ownerId: string) => {
    const userUid = auth().currentUser?.uid
    if (userUid === ownerId) return I18n.t('you')
    const profile = OtherPlayers.store.players.find(a => a.owner === ownerId)
    if (!profile) return I18n.t('anonymous')
    return `${profile.firstName} ${profile.lastName}`
  },
  getComPlan: (ownerId: string) => {
    const userUid = auth().currentUser?.uid
    if (userUid === ownerId) return OnlinePlayer.store.plan
    const plan = OtherPlayers.store.players.find(a => a.owner === ownerId)?.plan
    if (!plan) return 0
    return plan
  },
  getOncePost: async () => {
    await firestore()
      .collection('Profiles')
      .get()
      .then(snap => OtherPlayers.getOtherProf({ snapshot: snap }))
    await firestore().collection('Posts').get().then(PostStore.fetchPosts)
    await firestore().collection('Comments').get().then(PostStore.fetchComments)
  },
  translateText: async (text: string) => {
    return text
  }
}
