import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const STORAGE_KEY = '@aiAnswerCache'
export const MAX_CACHED_ANSWERS = 5

export interface CachedAiAnswerT {
  postId: string
  text: string
  plan: number
  timestamp: number
}

export async function loadCachedAiAnswers(): Promise<CachedAiAnswerT[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch (error) {
    captureException(error, 'loadCachedAiAnswers')
  }
  return []
}

export async function saveCachedAiAnswers(
  answers: CachedAiAnswerT[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  } catch (error) {
    captureException(error, 'saveCachedAiAnswers')
  }
}

export async function addCachedAiAnswer(
  answer: CachedAiAnswerT
): Promise<CachedAiAnswerT[]> {
  const existing = await loadCachedAiAnswers()
  const filtered = existing.filter((a) => a.postId !== answer.postId)
  const next = [answer, ...filtered].slice(0, MAX_CACHED_ANSWERS)
  await saveCachedAiAnswers(next)
  return next
}

export async function clearCachedAiAnswers(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    captureException(error, 'clearCachedAiAnswers')
  }
}
