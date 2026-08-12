import AsyncStorage from '@react-native-async-storage/async-storage'
import auth from '@react-native-firebase/auth'
import { nanoid } from 'nanoid/non-secure'

import { captureException, generateComment } from '../constants'
import { LEELA_ID } from '@env'
import { flagEmoji, lang } from '../i18n'
import { PostStore } from '../store'
import { FormPostT, PostT } from '../types/types'

const STORAGE_KEY = '@offlinePostQueue'

export interface QueuedPost extends FormPostT {
  id: string
  createTime: number
}

export async function loadQueuedPosts(): Promise<QueuedPost[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    captureException(error, 'loadQueuedPosts')
    return []
  }
}

export async function saveQueuedPosts(posts: QueuedPost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch (error) {
    captureException(error, 'saveQueuedPosts')
  }
}

export async function enqueuePost(post: QueuedPost): Promise<void> {
  const queue = await loadQueuedPosts()
  queue.push(post)
  await saveQueuedPosts(queue)
}

export async function removeQueuedPost(id: string): Promise<void> {
  const queue = await loadQueuedPosts()
  await saveQueuedPosts(queue.filter((p) => p.id !== id))
}

export async function clearQueuedPosts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    captureException(error, 'clearQueuedPosts')
  }
}

export async function buildQueuedPost(formPost: FormPostT): Promise<PostT | null> {
  const userUid = auth().currentUser?.uid
  const email = auth().currentUser?.email
  if (!userUid || !email) return null

  const id = nanoid()
  return {
    ...formPost,
    id,
    createTime: Date.now(),
    email,
    comments: [],
    liked: [],
    accept: true,
    language: lang,
    flagEmoji,
    ownerId: userUid
  }
}

export async function replayQueuedPost(post: QueuedPost): Promise<boolean> {
  try {
    const saved = await PostStore.savePostFromQueue(post as PostT)
    if (!saved) return false

    try {
      const { response } = await generateComment({
        message: post.text || '',
        systemMessage: post.systemMessage,
        planText: post.planText,
        pro: post.pro
      })
      if (response.trim()) {
        await PostStore.createComment({
          text: response,
          postId: post.id,
          postOwner: post.ownerId || '',
          ownerId: LEELA_ID
        })
      }
    } catch (aiError) {
      captureException(aiError, 'replayQueuedPost: AI comment')
    }

    await removeQueuedPost(post.id)
    return true
  } catch (error) {
    captureException(error, 'replayQueuedPost')
    return false
  }
}
