import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  clearSimplifiedAnswer,
  loadSimplifiedAnswer,
  saveSimplifiedAnswer,
  simplifyAnswer,
  SIMPLIFY_MIN_LENGTH
} from './aiSimplify'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe('simplifyAnswer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when text is below the minimum length', async () => {
    const result = await simplifyAnswer('short')
    expect(result).toBeNull()
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('returns null for empty text', async () => {
    const result = await simplifyAnswer('')
    expect(result).toBeNull()
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('returns the simplified content from the API', async () => {
    const longText = 'a'.repeat(SIMPLIFY_MIN_LENGTH + 1)
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'Simpler version.' } }]
      }
    } as any)

    const result = await simplifyAnswer(longText)
    expect(result).toBe('Simpler version.')
    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
  })

  it('returns null when the API response has no content', async () => {
    const longText = 'a'.repeat(SIMPLIFY_MIN_LENGTH + 1)
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: {} }] }
    } as any)

    const result = await simplifyAnswer(longText)
    expect(result).toBeNull()
  })

  it('returns null when the API throws', async () => {
    const longText = 'a'.repeat(SIMPLIFY_MIN_LENGTH + 1)
    mockedAxios.post.mockRejectedValue(new Error('network error'))

    const result = await simplifyAnswer(longText)
    expect(result).toBeNull()
  })

  describe('storage helpers', () => {
    it('loadSimplifiedAnswer reads from AsyncStorage', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce('stored')
      const result = await loadSimplifiedAnswer('post-1')
      expect(result).toBe('stored')
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        '@simplifiedAiAnswer_post-1'
      )
    })

    it('saveSimplifiedAnswer writes to AsyncStorage', async () => {
      await saveSimplifiedAnswer('post-2', 'simpler')
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@simplifiedAiAnswer_post-2',
        'simpler'
      )
    })

    it('clearSimplifiedAnswer removes the stored value', async () => {
      await clearSimplifiedAnswer('post-3')
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
        '@simplifiedAiAnswer_post-3'
      )
    })
  })
})
