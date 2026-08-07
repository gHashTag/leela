import { buildSystemMessage, loadAiPersona, saveAiPersona } from './aiPersona'
import AsyncStorage from '@react-native-async-storage/async-storage'

const t = (key: string) => {
  if (key === 'system') return 'You are Leela.'
  if (key === 'aiPersona.scholar') return 'Speak as a precise scholar.'
  if (key === 'aiPersona.friend') return 'Speak as a warm friend.'
  if (key === 'aiPersona.guru') return 'Speak as a wise guru.'
  return key
}

describe('aiPersona', () => {
  beforeEach(() => {
    AsyncStorage.clear?.()
  })

  it('returns the default persona when nothing is saved', async () => {
    const persona = await loadAiPersona()
    expect(persona).toBe('guru')
  })

  it('saves and loads a valid persona', async () => {
    await saveAiPersona('friend')
    const loaded = await loadAiPersona()
    expect(loaded).toBe('friend')
  })

  it('ignores invalid stored values and falls back to default', async () => {
    await AsyncStorage.setItem('@aiGuidePersona', 'robot')
    const loaded = await loadAiPersona()
    expect(loaded).toBe('guru')
  })

  it('builds a system message with the persona suffix', () => {
    const message = buildSystemMessage(t, 'scholar')
    expect(message).toContain('You are Leela.')
    expect(message).toContain('Speak as a precise scholar.')
  })
})
