import { makeAutoObservable } from 'mobx'
import { FormPostT, PostT, CommentT, FormCommentT } from '../types'
import auth from '@react-native-firebase/auth'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { OnlinePlayerStore } from './PlayersStore'
import { getIMG } from '../screens/helper'
import { nanoid } from 'nanoid/non-secure'

type fetchI = FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>

interface postStoreT {
    posts: PostT[]
    comments: CommentT[]
}

export const PostStore = {
    store: makeAutoObservable<postStoreT>({
        posts: [],
        comments: []
    }),
    createPost: async ({ text, plan }: FormPostT) => {
        const userUid = auth().currentUser?.uid
        const imgPath = auth().currentUser?.photoURL
        if (userUid) {
            const id = nanoid()
            const post: PostT = {
                text, plan,
                firstName: OnlinePlayerStore.profile.firstName,
                lastName: OnlinePlayerStore.profile.lastName,
                ownerId: userUid,
                avatar: imgPath ? imgPath : '',
                id, createTime: Date.now()
            }
            await firestore().collection('Posts').doc(id).set(post)
        }
    },
    createComment: async ({ text, postId, postOwner }: FormCommentT) => {
        const userUid = auth().currentUser?.uid
        const imgPath = auth().currentUser?.photoURL
        if (userUid) {
            const comment: CommentT = {
                text, postId, postOwner,
                firstName: OnlinePlayerStore.profile.firstName,
                lastName: OnlinePlayerStore.profile.lastName,
                ownerId: userUid, createTime: Date.now(),
                avatar: imgPath ? imgPath : '',
            }
            await firestore().collection('Comments').add(comment)
        }
    },
    fetchPosts: async (querySnap: fetchI) => {
        const res: any[] = await Promise.all(
            querySnap.docs.map(async a => {
                if (a.exists) {
                    const data = a.data()
                    // const comments = await getComments(data.id)
                    return {
                        ...data,
                        avatar: data.avatar ? await getIMG(data.avatar) : '',
                    }
                }
            }).filter((a: any) => a !== undefined)
        )
        if (res.length > 0) {
            PostStore.store.posts = res.sort((a, b) => b.createTime - a.createTime)
        }
    },
    fetchComments: async (querySnap: fetchI) => {
        const res: any[] = await Promise.all(
            querySnap.docs.map(async (a) => {
                if (a.exists) {
                    const data = a.data()
                    return {
                        ...data,
                        avatar: data.avatar ? await getIMG(data.avatar) : '',
                    }
                }
            }).filter((a: any) => a !== undefined)
        )
        if (res.length > 0) {
            PostStore.store.comments = res
        }
    }
}

const getComments = async (postId: string): Promise<CommentT[] | any[]> => {
    const comments = await firestore().collection('Comments')
        .where('postId', '==', postId).get()
    return comments.docs
}