import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  canRequestReview,
  getPositiveAiAnswerCount,
  markReviewRequested,
  recordPositiveAiAnswer,
  resetPositiveAiAnswerCount
} from './reviewPrompt'

describe('reviewPrompt', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('records positive AI answer count', async () => {
    await recordPositiveAiAnswer()
    await recordPositiveAiAnswer()
    const count = await getPositiveAiAnswerCount()
    expect(count).toBe(2)
  })

  it('allows review only after three positive answers', async () => {
    await recordPositiveAiAnswer()
    await recordPositiveAiAnswer()
    expect(await canRequestReview()).toBe(false)

    await recordPositiveAiAnswer()
    expect(await canRequestReview()).toBe(true)
  })

  it('blocks review once already requested', async () => {
    await recordPositiveAiAnswer()
    await recordPositiveAiAnswer()
    await recordPositiveAiAnswer()
    await markReviewRequested()

    expect(await canRequestReview()).toBe(false)
  })

  it('resets the positive answer count', async () => {
    await recordPositiveAiAnswer()
    await recordPositiveAiAnswer()
    await resetPositiveAiAnswerCount()

    expect(await getPositiveAiAnswerCount()).toBe(0)
  })
})
