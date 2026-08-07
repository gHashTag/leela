import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  buildAiLanguageInstruction,
  buildAiLanguageInstructionSync,
  getForceAiLanguage,
  setForceAiLanguage
} from './aiLanguage'


jest.mock('i18next', () => ({
  language: 'en',
  t: jest.fn((key: string, options?: { lng?: string }) => {
    if (key === 'aiLanguage.instruction') {
      return options?.lng === 'ru' ? 'Отвечай на русском языке.' : 'Answer in English.'
    }
    return key
  })
}))

const mockedT = jest.requireMock('i18next').t as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  AsyncStorage.clear()
})

describe('aiLanguage preference', () => {
  it('defaults to false', async () => {
    const value = await getForceAiLanguage()
    expect(value).toBe(false)
  })

  it('persists true preference', async () => {
    await setForceAiLanguage(true)
    expect(await getForceAiLanguage()).toBe(true)
  })

  it('persists false preference', async () => {
    await setForceAiLanguage(true)
    await setForceAiLanguage(false)
    expect(await getForceAiLanguage()).toBe(false)
  })
})

describe('buildAiLanguageInstruction', () => {
  it('returns null when toggle is off', async () => {
    await setForceAiLanguage(false)
    const instruction = await buildAiLanguageInstruction('en')
    expect(instruction).toBeNull()
    expect(mockedT).not.toHaveBeenCalled()
  })

  it('returns English instruction for en', async () => {
    await setForceAiLanguage(true)
    const instruction = await buildAiLanguageInstruction('en')
    expect(instruction).toBe('Answer in English.')
    expect(mockedT).toHaveBeenCalledWith('aiLanguage.instruction', {
      lng: 'en',
      defaultValue: 'Answer in the language of the app.'
    })
  })

  it('returns Russian instruction for ru', async () => {
    await setForceAiLanguage(true)
    const instruction = await buildAiLanguageInstruction('ru')
    expect(instruction).toBe('Отвечай на русском языке.')
    expect(mockedT).toHaveBeenCalledWith('aiLanguage.instruction', {
      lng: 'ru',
      defaultValue: 'Answer in the language of the app.'
    })
  })

  it('falls back to current i18next language when none supplied', async () => {
    await setForceAiLanguage(true)
    const instruction = await buildAiLanguageInstruction('')
    expect(instruction).toBe('Answer in English.')
    expect(mockedT).toHaveBeenCalledWith('aiLanguage.instruction', {
      lng: 'en',
      defaultValue: 'Answer in the language of the app.'
    })
  })
})

describe('buildAiLanguageInstructionSync', () => {
  it('returns null when disabled', () => {
    const t = jest.fn(() => 'Answer in English.')
    expect(buildAiLanguageInstructionSync(t as any, false)).toBeNull()
    expect(t).not.toHaveBeenCalled()
  })

  it('returns translated instruction when enabled', () => {
    const t = jest.fn(() => 'Отвечай на русском языке.')
    expect(buildAiLanguageInstructionSync(t as any, true)).toBe('Отвечай на русском языке.')
    expect(t).toHaveBeenCalledWith('aiLanguage.instruction')
  })
})
