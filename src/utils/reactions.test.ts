import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadReaction, REACTIONS, saveReaction } from './reactions'

jest.mock('@react-native-async-storage/async-storage')
const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe('reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when no reaction is stored for a post', async () => {
    mockedStorage.getItem.mockResolvedValueOnce(null)
    const result = await loadReaction('post-1')
    expect(result).toBeNull()
    expect(mockedStorage.getItem).toHaveBeenCalledWith('@reaction_post_post-1')
  })

  it('returns a stored valid reaction for a comment', async () => {
    mockedStorage.getItem.mockResolvedValueOnce('🔥')
    const result = await loadReaction('post-2', 'comment-1')
    expect(result).toBe('🔥')
    expect(mockedStorage.getItem).toHaveBeenCalledWith(
      '@reaction_comment_post-2_comment-1'
    )
  })

  it('returns null for an invalid stored value', async () => {
    mockedStorage.getItem.mockResolvedValueOnce('👎')
    const result = await loadReaction('post-3')
    expect(result).toBeNull()
  })

  it('saves a reaction', async () => {
    await saveReaction('post-4', '🙏')
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      '@reaction_post_post-4',
      '🙏'
    )
  })

  it('removes a reaction when null is passed', async () => {
    await saveReaction('post-5', null, 'comment-2')
    expect(mockedStorage.removeItem).toHaveBeenCalledWith(
      '@reaction_comment_post-5_comment-2'
    )
  })

  it('exposes exactly three reactions', () => {
    expect(REACTIONS).toEqual(['🙏', '❤️', '🔥'])
  })
})
