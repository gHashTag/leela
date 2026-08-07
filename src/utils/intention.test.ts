import {
  clearTodayIntention,
  loadTodayIntention,
  saveTodayIntention
} from './intention'
import AsyncStorage from '@react-native-async-storage/async-storage'

describe('intention', () => {
  beforeEach(() => {
    AsyncStorage.clear?.()
  })

  it('returns null when no intention is saved', async () => {
    const value = await loadTodayIntention()
    expect(value).toBeNull()
  })

  it('saves and loads an intention', async () => {
    await saveTodayIntention('Play with kindness')
    const value = await loadTodayIntention()
    expect(value).toBe('Play with kindness')
  })

  it('clears a saved intention', async () => {
    await saveTodayIntention('Play with kindness')
    await clearTodayIntention()
    const value = await loadTodayIntention()
    expect(value).toBeNull()
  })
})
