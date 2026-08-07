import { I18nManager } from 'react-native'

import {
  isDeviceRTL,
  isRTLLanguage,
  RTL_LANGS,
  syncRTLDirection
} from './rtl'

jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [
    { countryCode: 'US', languageTag: 'en-US', languageCode: 'en', isRTL: false }
  ])
}))

jest.mock('react-native', () => ({
  I18nManager: {
    isRTL: false,
    allowRTL: jest.fn(),
    forceRTL: jest.fn()
  }
}))

describe('rtl utilities', () => {
  beforeEach(() => {
    const RNLocalize = require('react-native-localize')
    RNLocalize.getLocales.mockReturnValue([
      { countryCode: 'US', languageTag: 'en-US', languageCode: 'en', isRTL: false }
    ])
    I18nManager.allowRTL.mockClear()
    I18nManager.forceRTL.mockClear()
    ;(I18nManager.isRTL as boolean) = false
  })

  it('lists Arabic as an RTL language', () => {
    expect(RTL_LANGS).toContain('ar')
  })

  it('detects device RTL from RNLocalize', () => {
    const RNLocalize = require('react-native-localize')
    RNLocalize.getLocales.mockReturnValueOnce([
      { languageCode: 'ar', countryCode: 'EG', isRTL: true }
    ])
    expect(isDeviceRTL()).toBe(true)
  })

  it('falls back to false when no locales are present', () => {
    const RNLocalize = require('react-native-localize')
    RNLocalize.getLocales.mockReturnValueOnce([])
    expect(isDeviceRTL()).toBe(false)
  })

  it('recognizes Arabic as RTL', () => {
    expect(isRTLLanguage('ar')).toBe(true)
  })

  it('does not treat English as RTL', () => {
    expect(isRTLLanguage('en')).toBe(false)
  })

  it('forces RTL when the language requires it', () => {
    ;(I18nManager.isRTL as boolean) = false
    const needsReload = syncRTLDirection('ar')
    expect(needsReload).toBe(true)
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(true)
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true)
  })

  it('does nothing when direction already matches', () => {
    ;(I18nManager.isRTL as boolean) = false
    const needsReload = syncRTLDirection('en')
    expect(needsReload).toBe(false)
    expect(I18nManager.forceRTL).not.toHaveBeenCalled()
  })
})
