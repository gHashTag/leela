import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import { SettingsScene } from './index'

jest.mock('../../components/HapticToggle', () => ({
  HapticToggle: () => null
}))

jest.mock('../../components/ReducedMotionToggle', () => ({
  ReducedMotionToggle: () => null
}))

jest.mock('../../components/ThemeSelector', () => ({
  ThemeSelector: () => null
}))

jest.mock('../../components/AccessibilityStatusCard', () => ({
  AccessibilityStatusCard: () => null
}))

jest.mock('../../utils/soundSettings', () => ({
  loadSoundEnabled: jest.fn().mockResolvedValue(true),
  saveSoundEnabled: jest.fn()
}))

jest.mock('../../utils/aiLanguage', () => ({
  getForceAiLanguage: jest.fn().mockResolvedValue(false),
  setForceAiLanguage: jest.fn()
}))

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() })
}))

describe('<SettingsScene />', () => {
  it('renders grouped settings sections', async () => {
    const { getByText, getByTestId } = render(
      <SettingsScene navigation={{ navigate: jest.fn() } as any} />
    )
    await waitFor(() => {
      expect(getByText('Settings')).toBeTruthy()
      expect(getByTestId('settings-sound')).toBeTruthy()
      expect(getByTestId('settings-ai-language')).toBeTruthy()
      expect(getByTestId('settings-edit-profile')).toBeTruthy()
      expect(getByTestId('settings-subscription')).toBeTruthy()
    })
  })
})
