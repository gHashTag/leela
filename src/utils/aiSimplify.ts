import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'
import { streamZaiChat } from './aiStream'

const SIMPLIFIED_STORAGE_KEY = (postId: string) =>
  `@simplifiedAiAnswer_${postId}`

export const SIMPLIFY_MIN_LENGTH = 240

export const loadSimplifiedAnswer = async (
  postId: string
): Promise<string | null> => {
  return AsyncStorage.getItem(SIMPLIFIED_STORAGE_KEY(postId))
}

export const saveSimplifiedAnswer = async (
  postId: string,
  text: string
): Promise<void> => {
  await AsyncStorage.setItem(SIMPLIFIED_STORAGE_KEY(postId), text)
}

export const clearSimplifiedAnswer = async (postId: string): Promise<void> => {
  await AsyncStorage.removeItem(SIMPLIFIED_STORAGE_KEY(postId))
}

export async function simplifyAnswer(text: string): Promise<string | null> {
  if (!text || text.length < SIMPLIFY_MIN_LENGTH) return null

  try {
    const response = await streamZaiChat(
      {
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Rewrite the user-provided text in simpler, shorter language. Preserve the core teaching and any scripture references. Keep the answer under 120 words. Respond only with the rewritten text, no preamble.'
          },
          { role: 'user', content: text }
        ]
      },
      {}
    )

    return response.content.trim() || null
  } catch (error) {
    captureException(error, 'simplifyAnswer')
    return null
  }
}
