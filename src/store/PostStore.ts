import { makeAutoObservable } from 'mobx'
import { FormPostT, PostT, CommentT, FormCommentT } from '../types'
import auth from '@react-native-firebase/auth'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { nanoid } from 'nanoid/non-secure'
import { OnlinePlayer } from './OnlinePlayer'
import { OtherPlayers } from './OtherPlayers'

type fetchI = FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>

interface postStoreT {
  posts: PostT[]
  comments: CommentT[]
  loadPosts: boolean
}

export const PostStore = {
  store: makeAutoObservable<postStoreT>({
    posts: [],
    comments: [],
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
    if (userUid && email) {
      const comment: CommentT = {
        text,
        postId,
        postOwner,
        firstName: OnlinePlayer.store.profile.firstName,
        lastName: OnlinePlayer.store.profile.lastName,
        ownerId: userUid,
        createTime: Date.now(),
        email
      }
      await firestore().collection('Comments').add(comment)
    }
  },
  fetchPosts: async (querySnap: fetchI) => {
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
  fetchComments: async (querySnap: fetchI) => {
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
      PostStore.store.comments = res
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
    if (userUid === ownerId) return 'You'
    const profile = OtherPlayers.store.players.find(a => a.owner === ownerId)
    if (!profile) return 'Anonymous'
    return `${profile.firstName} ${profile.lastName}`
  },
  getComPlan: (ownerId: string) => {
    const userUid = auth().currentUser?.uid
    if (userUid === ownerId) return OnlinePlayer.store.plan
    const plan = OtherPlayers.store.players.find(a => a.owner === ownerId)?.plan
    if (!plan) return 0
    return plan
  }
}
