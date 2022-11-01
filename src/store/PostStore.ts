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
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { nanoid } from 'nanoid/non-secure'
import { OnlinePlayer } from './OnlinePlayer'
import { OtherPlayers } from './OtherPlayers'
import { getProfile, getUid } from '../screens/helper'
import I18n from 'i18n-js'
// @ts-ignore
import { YANDEX_TRANSLATE_API_KEY, YANDEX_FOLDER_ID } from '@env'
import { captureException } from '../constants'
import { AllLang } from '../utils'

type fetchT = FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
interface postStoreT {
  posts: PostT[]
  ownPosts: PostT[]
  comments: CommentT[]
  replyComments: ReplyComT[]
  loadPosts: boolean
  loadOwnPosts: boolean
}

interface delCommentT {
  commentId: string
  isReply: boolean
  postId?: string
}

interface delCommentIdT {
  commentId: string
  postId?: string
}

export const PostStore = {
  store: makeAutoObservable<postStoreT>({
    posts: [],
    ownPosts: [],
    comments: [],
    replyComments: [],
    loadOwnPosts: true,
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
        comments: [],
        liked: [],
        accept: false,
        language: AllLang
      }
      try {
        await firestore().collection('Posts').doc(id).set(post)
      } catch (error) {
        captureException(error)
      }
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
      await firestore()
        .collection('Posts')
        .doc(postId)
        .update({ comments: firestore.FieldValue.arrayUnion(path) })
      await firestore().collection('Comments').doc(path).set(comment)
    }
  },
  removeCommentIdInPost: async ({ commentId, postId }: delCommentIdT) => {
    postId &&
      firestore()
        .collection('Posts')
        .doc(postId)
        .update({ comments: firestore.FieldValue.arrayRemove(commentId) })
  },
  delComment: async ({ commentId, isReply, postId }: delCommentT) => {
    await firestore().collection('Comments').doc(commentId).delete()
    PostStore.store.comments = PostStore.store.comments.filter(a => a.id !== commentId)
    PostStore.removeCommentIdInPost({ commentId, postId })
    if (!isReply) {
      firestore()
        .collection('Comments')
        .where('commentId', '==', commentId)
        .get()
        .then(function (querySnap) {
          querySnap.forEach(function (doc) {
            const data = doc.data()
            const commentId = data.id
            PostStore.removeCommentIdInPost({ commentId, postId })
            doc.ref.delete()
          })
        })
    }
  },
  replyComment: async ({ text, commentId, postId, commentOwner }: FormReplyCom) => {
    const userUid = auth().currentUser?.uid
    const prof = await getProfile()
    if (prof) {
      const path = nanoid(23)
      if (userUid) {
        const comment: ReplyComT = {
          text,
          postId,
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
        await firestore()
          .collection('Posts')
          .doc(postId)
          .update({ comments: firestore.FieldValue.arrayUnion(path) })
        await firestore().collection('Comments').doc(path).set(comment)
      }
    }
  },
  fetchPosts: async (querySnap: fetchT) => {
    PostStore.store.loadPosts = true
    const uid = getUid()
    const isAdmin = OnlinePlayer.store.status === 'Admin'
    const res: any[] = querySnap.docs
      .map(a => {
        if (a.exists) {
          const data = a.data()
          return data
        }
      })
      .filter(a => a !== undefined)
      .filter(a => (isAdmin ? true : a?.ownerId === uid ? true : a?.accept))
    if (res.length > 0) {
      PostStore.store.posts = res.sort((a, b) => b.createTime - a.createTime)
    }
    PostStore.store.loadPosts = false
  },
  fetchOwnPosts: async (querySnap: fetchT) => {
    PostStore.store.loadOwnPosts = true
    const uid = getUid()
    const isAdmin = OnlinePlayer.store.status === 'Admin'
    const res: any[] = querySnap.docs
      .map(a => {
        if (a.exists) {
          const data = a.data()
          return data
        }
      })
      .filter(a => a !== undefined)
      .filter(a => (isAdmin ? true : a?.ownerId === uid ? true : a?.accept))
    if (res.length > 0) {
      PostStore.store.ownPosts = res.sort((a, b) => b.createTime - a.createTime)
    }
    PostStore.store.loadOwnPosts = false
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
  unlikePost: async (postId: string) => {
    const userUid = auth().currentUser?.uid
    await firestore()
      .collection('Posts')
      .doc(postId)
      .update({
        liked: firestore.FieldValue.arrayRemove(userUid)
      })
  },
  getOwnerName: (ownerId: string, full?: boolean) => {
    const userUid = auth().currentUser?.uid
    if (userUid === ownerId) return I18n.t('you')
    const profile = OtherPlayers.store.players.find(a => a.owner === ownerId)
    if (!profile) return I18n.t('anonymous')
    return full !== false
      ? `${profile.firstName} ${profile.lastName}`
      : `${profile.firstName}`
  },
  getComPlan: (ownerId: string) => {
    const userUid = getUid()
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
  },
  translateText: async (text: string) => {
    try {
      const res = await (
        await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Api-Key ${YANDEX_TRANSLATE_API_KEY}`
          },
          body: JSON.stringify({
            folderId: YANDEX_FOLDER_ID,
            texts: text,
            targetLanguageCode: AllLang
          })
        })
      ).json()
      if (res?.translations && res.translations?.length > 0) {
        return res.translations[0].text
      }
    } catch (err) {
      captureException(err)
    }
    return text
  },
  getAvaById: (uid: string) => {
    const userUid = getUid()
    if (userUid === uid) return OnlinePlayer.store.avatar
    const otherUserAva = OtherPlayers.store.players.find(a => a.owner === uid)?.avatar
    return otherUserAva
      ? otherUserAva
      : 'https://leelachakra.com/resource/LeelaChakra/anonymous.png'
  },
  banUnbanUser: async (uid: string) => {
    try {
      const profile = (await firestore().collection('Profiles').doc(uid).get()).data()
      if (profile && profile.status !== 'Admin') {
        if (profile.status === 'ban') {
          firestore().collection('Profiles').doc(uid).update({ status: null })
        } else {
          firestore().collection('Profiles').doc(uid).update({ status: 'ban' })
        }
      }
    } catch (error) {
      captureException(error)
    }
  },
  delPost: (id: string) => {
    firestore()
      .collection('Comments')
      .where('postId', '==', id)
      .get()
      .then(querySnap => {
        querySnap.forEach(async doc => {
          const data = doc.data()
          const comId = data.id
          PostStore.delComment({ commentId: comId, isReply: true })
        })
      })
    firestore().collection('Posts').doc(id).delete()
  },
  delAllUserPosts: async (userUid: string) => {
    firestore()
      .collection('Posts')
      .where('ownerId', '==', userUid)
      .get()
      .then(querySnap => {
        querySnap.forEach(async doc => {
          const postId = doc.data().id
          PostStore.delPost(postId)
        })
      })
  },
  delAllUserComments: async (userUid: string) => {
    firestore()
      .collection('Comments')
      .where('ownerId', '==', userUid)
      .get()
      .then(querySnap => {
        querySnap.forEach(async doc => {
          const data = doc.data()
          const commentId = data.id
          const isReply = data.reply
          const postId = data.postId
          PostStore.delComment({ commentId, isReply, postId })
        })
      })
  },
  acceptPost: (isAccept: boolean, postId: string) => {
    firestore().collection('Posts').doc(postId).update({ accept: !isAccept })
  }
}
