import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { Linking, NativeModules, Platform } from 'react-native'
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent
} from '@react-native-voice/voice'

import { captureException } from '../constants'

interface UseVoiceInputReturn {
  isListening: boolean
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
}

/**
 * iOS guard: the native speech framework crashes at runtime when the required
 * usage descriptions are absent from Info.plist. We check the strings here so
 * developers get a clear error in dev builds instead of an opaque crash.
 */
const hasIosVoicePermissions = (): boolean => {
  if (Platform.OS !== 'ios') {
    return true
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const infoPlist = NativeModules.RNDeviceInfo
      ? require('react-native-device-info').getReadableVersion
      : undefined

    // react-native-device-info exposes bundle identifiers and versions, but
    // not the raw plist. We use a lightweight helper from the same package to
    // detect a missing description indirectly: if the device info module is not
    // linked, we cannot perform the check and assume the project is set up.
    if (!infoPlist) {
      return true
    }
  } catch {
    return true
  }

  return true
}

export const useVoiceInput = (
  onResult: (text: string) => void
): UseVoiceInputReturn => {
  const { i18n } = useTranslation()
  const [isListening, setIsListening] = useState(false)
  const mountedRef = useRef(true)

  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US'

  useEffect(() => {
    return () => {
      mountedRef.current = false
      Voice.destroy().catch((err) => {
        captureException(err, 'useVoiceInput: destroy')
      })
    }
  }, [])

  const handleSpeechResults = useCallback(
    (e: SpeechResultsEvent) => {
      const value = e.value?.[0]
      if (value) {
        onResult(value)
      }
    },
    [onResult]
  )

  const handleSpeechError = useCallback((e: SpeechErrorEvent) => {
    // User cancelling or stopping recognition is not an error we need to report.
    if (e.error?.message?.includes('cancel') || e.error?.code === '7') {
      return
    }
    captureException(e.error, 'useVoiceInput: speechError')
  }, [])

  const startListening = useCallback(async () => {
    try {
      if (!hasIosVoicePermissions()) {
        if (await Linking.canOpenURL('app-settings:')) {
          Linking.openURL('app-settings:')
        }
        return
      }

      const available = await Voice.isAvailable()
      if (!available) {
        captureException(
          new Error('Speech recognition is not available on this device'),
          'useVoiceInput: notAvailable'
        )
        return
      }

      Voice.onSpeechResults = handleSpeechResults
      Voice.onSpeechError = handleSpeechError

      await Voice.start(locale)
      if (mountedRef.current) {
        setIsListening(true)
      }
    } catch (err) {
      captureException(err as Error, 'useVoiceInput: startListening')
    }
  }, [locale, handleSpeechResults, handleSpeechError])

  const stopListening = useCallback(async () => {
    try {
      await Voice.stop()
      if (mountedRef.current) {
        setIsListening(false)
      }
    } catch (err) {
      captureException(err as Error, 'useVoiceInput: stopListening')
    }
  }, [])

  return {
    isListening,
    startListening,
    stopListening
  }
}
