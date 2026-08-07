import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const AI_THUMBS_UP_COUNT_KEY = '@aiThumbsUpCount'
const REVIEW_REQUESTED_KEY = '@reviewRequested'
const MIN_AI_THUMBS_UP_BEFORE_REVIEW = 3

export async function recordPositiveAiAnswer(): Promise<void> {
  try {
    const current = Number(
      (await AsyncStorage.getItem(AI_THUMBS_UP_COUNT_KEY)) || '0'
    )
    await AsyncStorage.setItem(
      AI_THUMBS_UP_COUNT_KEY,
      String(current + 1)
    )
  } catch (error) {
    captureException(error, 'recordPositiveAiAnswer')
  }
}

export async function resetPositiveAiAnswerCount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AI_THUMBS_UP_COUNT_KEY)
  } catch (error) {
    captureException(error, 'resetPositiveAiAnswerCount')
  }
}

const POSITIVE_EVENT_COUNT_KEY = '@positiveEvents'

export async function recordPositiveEvent(): Promise<void> {
  try {
    const current = Number(
      (await AsyncStorage.getItem(POSITIVE_EVENT_COUNT_KEY)) || '0'
    )
    await AsyncStorage.setItem(
      POSITIVE_EVENT_COUNT_KEY,
      String(current + 1)
    )
  } catch (error) {
    captureException(error, 'recordPositiveEvent')
  }
}

export async function getPositiveAiAnswerCount(): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(AI_THUMBS_UP_COUNT_KEY)) || '0')
  } catch (error) {
    captureException(error, 'getPositiveAiAnswerCount')
    return 0
  }
}

export async function hasReviewBeenRequested(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REVIEW_REQUESTED_KEY)) === 'true'
  } catch (error) {
    captureException(error, 'hasReviewBeenRequested')
    return true
  }
}

export async function markReviewRequested(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true')
  } catch (error) {
    captureException(error, 'markReviewRequested')
  }
}

export async function canRequestReview(): Promise<boolean> {
  if (await hasReviewBeenRequested()) return false

  try {
    const count = Number(
      (await AsyncStorage.getItem(AI_THUMBS_UP_COUNT_KEY)) || '0'
    )
    return count >= MIN_AI_THUMBS_UP_BEFORE_REVIEW
  } catch (error) {
    captureException(error, 'canRequestReview')
    return false
  }
}
