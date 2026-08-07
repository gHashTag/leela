import AsyncStorage from '@react-native-async-storage/async-storage'
import { loadAiFeedback, saveAiFeedback } from './aiFeedback'

describe('aiFeedback', () => {
  beforeEach(async () => {
    await AsyncStorage.clear?.()
  })

  it('returns null when no feedback is saved', async () => {
    const feedback = await loadAiFeedback('post-1')
    expect(feedback).toBeNull()
  })

  it('saves and loads feedback for a post', async () => {
    await saveAiFeedback('post-1', 'up')
    const feedback = await loadAiFeedback('post-1')
    expect(feedback).toBe('up')
  })

  it('updates feedback for the same post', async () => {
    await saveAiFeedback('post-1', 'up')
    await saveAiFeedback('post-1', 'down')
    const feedback = await loadAiFeedback('post-1')
    expect(feedback).toBe('down')
  })

  it('removes feedback when set to null', async () => {
    await saveAiFeedback('post-1', 'up')
    await saveAiFeedback('post-1', null)
    const feedback = await loadAiFeedback('post-1')
    expect(feedback).toBeNull()
  })

  it('keeps feedback for other posts isolated', async () => {
    await saveAiFeedback('post-1', 'up')
    await saveAiFeedback('post-2', 'down')

    expect(await loadAiFeedback('post-1')).toBe('up')
    expect(await loadAiFeedback('post-2')).toBe('down')
  })
})
