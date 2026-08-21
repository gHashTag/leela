import React, { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { s } from 'react-native-size-matters'
import { ButtonVectorIcon } from '../Buttons'
import { triggerHaptic } from '../../utils/haptics'
import { BookmarkT, isBookmarked, toggleBookmark } from '../../utils/bookmarks'

interface BookmarkButtonT {
  bookmark: BookmarkT
  size?: number
}

export const BookmarkButton = ({ bookmark, size = s(16) }: BookmarkButtonT) => {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)

  useEffect(() => {
    let mounted = true
    isBookmarked(bookmark.id).then((saved) => {
      if (mounted) setActive(saved)
    })
    return () => {
      mounted = false
    }
  }, [bookmark.id])

  const onPress = async () => {
    triggerHaptic(active ? 'impactLight' : 'impactMedium')
    const next = await toggleBookmark(bookmark)
    setActive(next)
  }

  return (
    <ButtonVectorIcon
      ionicons
      name={active ? 'bookmark' : 'bookmark-outline'}
      size={size}
      onPress={onPress}
      accessibilityLabel={
        active ? t('accessibility.removeBookmark') : t('accessibility.bookmark')
      }
      testID="bookmark-button"
    />
  )
}
