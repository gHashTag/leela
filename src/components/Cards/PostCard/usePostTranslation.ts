import { useEffect, useState } from 'react'

import { flagEmoji } from '../../../i18n'
import { PostStore } from '../../../store'
import { PostT } from '../../../types'

interface usePostTranslationParams {
  item?: PostT
  translatedText?: string
  isHideTranslate?: boolean
}

export const usePostTranslation = ({
  item,
  translatedText,
  isHideTranslate
}: usePostTranslationParams) => {
  const [transText, setTransText] = useState('')
  const [hideTranslate, setHideTranslate] = useState(true)

  useEffect(() => {
    if (translatedText) {
      setTransText(translatedText)
      setHideTranslate(!!isHideTranslate)
    }
  }, [translatedText, isHideTranslate])

  async function handleTranslate() {
    if (item?.text) {
      if (hideTranslate && transText === '') {
        const translated = await PostStore.translateText(item?.text)
        setTransText(translated)
      }
      setHideTranslate((pr) => !pr)
    }
  }

  const text = hideTranslate ? item?.text : transText

  const flag = (hideTranslate ? flagEmoji : item?.flagEmoji ?? '🇷🇺') as string

  return { transText, hideTranslate, handleTranslate, flag, text }
}
