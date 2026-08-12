import { useEffect, useState } from 'react'

import { AppTheme, getAppTheme, loadThemePreference, subscribeToTheme } from './themeSettings'

/**
 * Reactive hook for the user's chosen app theme.
 * Returns the stored preference and updates when the user changes it.
 */
export const useAppTheme = (): AppTheme => {
  const [theme, setTheme] = useState<AppTheme>(getAppTheme)

  useEffect(() => {
    let mounted = true
    loadThemePreference().then((value) => {
      if (mounted) setTheme(value)
    })
    const unsubscribe = subscribeToTheme((value) => {
      if (mounted) setTheme(value)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return theme
}
