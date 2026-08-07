import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const FEEDBACK_KEY = '@aiAnswerFeedback'

export type AiFeedback = 'up' | 'down' | null

export async function loadAiFeedback(postId: string): Promise<AiFeedback> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, AiFeedback>
    return map[postId] || null
  } catch (error) {
    captureException(error, 'loadAiFeedback')
    return null
  }
}

export async function saveAiFeedback(
  postId: string,
  feedback: AiFeedback
): Promise<void> {
  try {
    const raw = (await AsyncStorage.getItem(FEEDBACK_KEY)) || '{}'
    const map = JSON.parse(raw) as Record<string, AiFeedback>
    if (feedback === null) {
      delete map[postId]
    } else {
      map[postId] = feedback
    }
    await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(map))
  } catch (error) {
    captureException(error, 'saveAiFeedback')
  }
}
