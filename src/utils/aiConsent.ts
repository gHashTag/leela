import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert } from 'react-native'
import i18next from 'i18next'

const KEY = '@ai-data-sharing-v1'
let pending: Promise<boolean> | undefined
let revision = 0
let writes: Promise<void> = Promise.resolve()

function persist(value: string) {
  const result = writes.then(() => AsyncStorage.setItem(KEY, value))
  writes = result.catch(() => {})
  return result
}

export const aiConsentText = () =>
  i18next.language?.startsWith('ru')
    ? {
        title: 'Передача текста AI',
        message:
          'Для ответа ваши сообщения, недавний диалог и контекст игрового плана отправляются на сервер Leela и внешним AI-провайдерам NVIDIA, Z.AI или OpenAI. Не отправляйте секреты и чувствительные данные. Разрешение можно отозвать в настройках. Без него доска и игра доступны, но AI не отвечает.',
        allow: 'Разрешить',
        deny: 'Не разрешать',
        revoke: 'Отключить передачу текста AI',
        saveError: 'Не удалось сохранить настройку. Попробуйте ещё раз.'
      }
    : {
        title: 'AI text sharing',
        message:
          'To answer, your messages, recent conversation and game-plane context are sent to the Leela server and third-party AI providers NVIDIA, Z.AI or OpenAI. Do not send secrets or sensitive data. You can withdraw permission in Settings. Without permission the board and game remain available, but AI will not answer.',
        allow: 'Allow',
        deny: 'Do not allow',
        revoke: 'Turn off AI text sharing',
        saveError: 'Could not save the setting. Please try again.'
      }

export const hasAIConsent = async () =>
  (await AsyncStorage.getItem(KEY)) === 'allowed'

export async function revokeAIConsent() {
  revision++
  await persist('denied')
}

/** A declined automatic request never opens another prompt; Settings can ask again. */
export function requestAIConsent(fromSettings = false): Promise<boolean> {
  if (pending) return pending
  const startedAt = revision
  pending = (async () => {
    const saved = await AsyncStorage.getItem(KEY)
    if (startedAt !== revision) return false
    if (saved === 'allowed') return true
    if (saved === 'denied' && !fromSettings) return false
    const words = aiConsentText()
    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        words.title,
        words.message,
        [
          { text: words.deny, style: 'cancel', onPress: () => resolve(false) },
          { text: words.allow, onPress: () => resolve(true) }
        ],
        { cancelable: false }
      )
    })
    if (startedAt !== revision) return false
    await persist(accepted ? 'allowed' : 'denied')
    return accepted && startedAt === revision
  })().finally(() => {
    pending = undefined
  })
  return pending
}

export async function requireAIConsent() {
  if (!(await requestAIConsent()))
    throw new Error('AI text sharing is disabled in Settings')
}
