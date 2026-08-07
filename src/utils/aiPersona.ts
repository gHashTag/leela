import AsyncStorage from '@react-native-async-storage/async-storage'
import { TFunction } from 'i18next'
import { captureException } from '../constants'

const STORAGE_KEY = '@aiGuidePersona'

export type AiPersona = 'scholar' | 'friend' | 'guru'

export const AI_PERSONAS: AiPersona[] = ['scholar', 'friend', 'guru']

export const defaultPersona: AiPersona = 'guru'

export async function loadAiPersona(): Promise<AiPersona> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY)
    if (value && AI_PERSONAS.includes(value as AiPersona)) {
      return value as AiPersona
    }
  } catch (error) {
    captureException(error, 'loadAiPersona')
  }
  return defaultPersona
}

export async function saveAiPersona(persona: AiPersona): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, persona)
  } catch (error) {
    captureException(error, 'saveAiPersona')
  }
}

export function buildSystemMessage(t: TFunction, persona: AiPersona): string {
  const base = t('system')
  const personaKey = `aiPersona.${persona}`
  const personaText = t(personaKey)
  return `${base}\n\n${personaText}`
}
