import { makeAutoObservable } from 'mobx'
import { FormPostT, PostT, CommentT, FormCommentT } from '../types'
import auth from '@react-native-firebase/auth'
import storage from '@react-native-firebase/storage'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { OnlinePlayerStore } from './PlayersStore'
import { getIMG } from '../screens/helper'
import { nanoid } from 'nanoid/non-secure'

export const PostStore = {
    store: makeAutoObservable({
        posts: [] as Array<any>
    }),
    createPost: async ({ text, plan }: FormPostT) => {
        const userUid = auth().currentUser?.uid
        const imgPath = auth().currentUser?.photoURL
        //const { posts } = PostStore.store
        if (userUid) {
            const id = nanoid()
            const post: PostT = {
                text, plan, comments: [],
                firstName: OnlinePlayerStore.profile.firstName,
                lastName: OnlinePlayerStore.profile.lastName,
                ownerId: userUid,
                avatar: imgPath ? imgPath : '',
                id
            }
            await firestore().collection('Posts').doc(id).set(post)/*.then(async() => {
                posts.push({...post, avatar: await getIMG(OnlinePlayerStore.avatar)})
            })*/
        }
    },
    createComment: async ({ text, id }: FormCommentT & { id: string }) => {
        const userUid = auth().currentUser?.uid
        const imgPath = auth().currentUser?.photoURL
        //const { posts } = PostStore.store
        if (userUid) {
            const comment: CommentT = {
                text,
                firstName: OnlinePlayerStore.profile.firstName,
                lastName: OnlinePlayerStore.profile.lastName,
                ownerId: userUid,
                avatar: imgPath ? imgPath : '',
            }
            await firestore().collection('Posts').doc(id).update({
                comments: firestore.FieldValue.arrayUnion(comment)
            })/*.then(async() => {
                const index = posts.findIndex(a => a.id === id)
                if (index >= 0) {
                    posts[index].comments?.push({
                        ...comment,
                        avatar: await getIMG(OnlinePlayerStore.avatar)
                    })
                }
            })*/
        }
    },
    fetchPosts: async (querySnap: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>) => {
        console.log('fetch')
        const res: any[] = await Promise.all(
            querySnap.docs.map(async a => {
                if (a.exists) {
                    const data = a.data()
                    return {
                        plan: data.plan,
                        text: data.text,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        ownerId: data.ownerId,
                        avatar: data.avatar ? await getIMG(data.avatar) : undefined,
                        comments: await Promise.all(data.comments.map(async (a) => {
                            return { ...a, avatar: await getIMG(a.avatar) }
                        })),
                        id: data.id
                    }
                }
            }).filter((a: any) => a !== undefined)
        )
        if (res.length > 0) {
            PostStore.store.posts = res
        }
    },
}
