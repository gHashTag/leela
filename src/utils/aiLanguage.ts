import AsyncStorage from '@react-native-async-storage/async-storage'
import i18next, { TFunction } from 'i18next'

const STORAGE_KEY = '@forceAiLanguage'

const logError = (error: unknown, target: string) => {
  if (__DEV__) {
    console.error(`aiLanguage:${target}`, error)
  }
}

export async function getForceAiLanguage(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY)
    return value === 'true'
  } catch (error) {
    logError(error, 'getForceAiLanguage')
    return false
  }
}

export async function setForceAiLanguage(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch (error) {
    logError(error, 'setForceAiLanguage')
  }
}

/**
 * Build an instruction that asks Leela to answer in the player's UI language.
 * Returns `null` when the toggle is off so callers can skip appending anything.
 */
export async function buildAiLanguageInstruction(
  language: string
): Promise<string | null> {
  if (!(await getForceAiLanguage())) return null

  const instruction = i18next.t('aiLanguage.instruction', {
    lng: language || i18next.language,
    defaultValue: 'Answer in the language of the app.'
  })

  return instruction
}

/**
 * Build the full system message for AI generation, optionally appending
 * a language instruction when the player has enabled the toggle.
 */
export async function buildAiSystemMessage(
  systemMessage: string,
  planText: string,
  language: string
): Promise<string> {
  const instruction = await buildAiLanguageInstruction(language)
  return instruction
    ? `${systemMessage}\n\n${planText}\n\n${instruction}`
    : `${systemMessage}\n\n${planText}`
}

/**
 * Synchronous variant for callers that already know the toggle state.
 */
export function buildAiLanguageInstructionSync(
  t: TFunction,
  enabled: boolean
): string | null {
  if (!enabled) return null
  return t('aiLanguage.instruction')
}
