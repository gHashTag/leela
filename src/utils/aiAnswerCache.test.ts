import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  addCachedAiAnswer,
  clearCachedAiAnswers,
  loadCachedAiAnswers,
  MAX_CACHED_ANSWERS,
  saveCachedAiAnswers
} from './aiAnswerCache'

describe('aiAnswerCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear?.()
  })

  it('returns an empty array when nothing is cached', async () => {
    const answers = await loadCachedAiAnswers()
    expect(answers).toEqual([])
  })

  it('saves and loads cached answers', async () => {
    const answers = [
      { postId: 'p1', text: 'Answer one', plan: 1, timestamp: 1 }
    ]
    await saveCachedAiAnswers(answers)
    const loaded = await loadCachedAiAnswers()
    expect(loaded).toEqual(answers)
  })

  it('adds a new answer to the front of the cache', async () => {
    await addCachedAiAnswer({ postId: 'p1', text: 'A1', plan: 1, timestamp: 1 })
    await addCachedAiAnswer({ postId: 'p2', text: 'A2', plan: 2, timestamp: 2 })

    const loaded = await loadCachedAiAnswers()
    expect(loaded[0]).toMatchObject({ postId: 'p2', text: 'A2' })
  })

  it('replaces an existing answer for the same post and keeps the limit', async () => {
    for (let i = 1; i <= MAX_CACHED_ANSWERS + 2; i++) {
      await addCachedAiAnswer({
        postId: `p${i}`,
        text: `A${i}`,
        plan: i,
        timestamp: i
      })
    }

    const loaded = await loadCachedAiAnswers()
    expect(loaded).toHaveLength(MAX_CACHED_ANSWERS)
  })

  it('replaces an existing answer for the same post id', async () => {
    await addCachedAiAnswer({
      postId: 'p1',
      text: 'old',
      plan: 1,
      timestamp: 1
    })
    await addCachedAiAnswer({
      postId: 'p1',
      text: 'new',
      plan: 1,
      timestamp: 2
    })

    const loaded = await loadCachedAiAnswers()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].text).toBe('new')
  })

  it('clears the cache', async () => {
    await addCachedAiAnswer({ postId: 'p1', text: 'A1', plan: 1, timestamp: 1 })
    await clearCachedAiAnswers()
    const loaded = await loadCachedAiAnswers()
    expect(loaded).toEqual([])
  })
})
