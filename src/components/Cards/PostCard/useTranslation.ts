import { useEffect, useState } from 'react'

import { PostStore } from '../../../store'
import { PostT } from '../../../types'
import { lang } from '../../../utils'

interface useTranslationParams {
  item?: PostT
  translatedText?: string
  isHideTranslate?: boolean
}

export const useTranslation = ({
  item,
  translatedText,
  isHideTranslate,
}: useTranslationParams) => {
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
      setHideTranslate(pr => !pr)
    }
  }

  const text = hideTranslate ? item?.text : transText

  const flag = hideTranslate
    ? lang === 'en'
      ? ':us:'
      : `:${lang}:`
    : item?.language === 'en'
    ? ':us:'
    : `:${item?.language}:`

  return { transText, hideTranslate, handleTranslate, flag, text }
}
