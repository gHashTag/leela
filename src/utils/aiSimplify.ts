import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'
import { OPEN_AI_KEY, ZAI_PLAN } from '@env'

const ZAI_CODING_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4'
const ZAI_DEFAULT_MODEL = 'glm-4.6'

const SIMPLIFIED_STORAGE_KEY = (postId: string) => `@simplifiedAiAnswer_${postId}`

export const SIMPLIFY_MIN_LENGTH = 240

export const loadSimplifiedAnswer = async (postId: string): Promise<string | null> => {
  return AsyncStorage.getItem(SIMPLIFIED_STORAGE_KEY(postId))
}

export const saveSimplifiedAnswer = async (postId: string, text: string): Promise<void> => {
  await AsyncStorage.setItem(SIMPLIFIED_STORAGE_KEY(postId), text)
}

export const clearSimplifiedAnswer = async (postId: string): Promise<void> => {
  await AsyncStorage.removeItem(SIMPLIFIED_STORAGE_KEY(postId))
}

export async function simplifyAnswer(text: string): Promise<string | null> {
  if (!text || text.length < SIMPLIFY_MIN_LENGTH) return null

  const baseURL = ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : ZAI_DEFAULT_BASE_URL

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: ZAI_DEFAULT_MODEL,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Rewrite the user-provided text in simpler, shorter language. Preserve the core teaching and any scripture references. Keep the answer under 120 words. Respond only with the rewritten text, no preamble.'
          },
          { role: 'user', content: text }
        ],
        max_tokens: 400,
        temperature: 0.1
      },
      {
        headers: {
          Authorization: `Bearer ${OPEN_AI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const choice = response?.data?.choices?.[0]?.message
    return (choice?.content || choice?.reasoning_content || '').trim() || null
  } catch (error) {
    captureException(error, 'simplifyAnswer')
    return null
  }
}
