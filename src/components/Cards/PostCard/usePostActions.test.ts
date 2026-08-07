import { Share } from 'react-native'

import { buildReportLink } from '../../../utils'
import { usePostActions } from './usePostActions'

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
  wrap: jest.fn((c) => c)
}))

jest.mock('../../../utils', () => ({
  buildReportLink: jest.fn()
}))

jest.mock('react-native', () => ({
  Share: {
    share: jest.fn()
  },
  Dimensions: {
    get: () => ({ width: 390, height: 844 })
  },
  Alert: {
    alert: jest.fn()
  },
  Linking: {
    openURL: jest.fn()
  },
  Platform: {
    OS: 'ios'
  }
}))

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() })
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: 'i18next' },
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => `${key}:${JSON.stringify(params || {})}` })
}))

jest.mock('../../../hooks', () => ({
  useTypedNavigation: () => ({ navigate: jest.fn() })
}))

jest.mock('../../../store', () => ({
  PostStore: {
    likePost: jest.fn(),
    unlikePost: jest.fn()
  }
}))

const mockedBuildReportLink = buildReportLink as jest.Mock
const mockedShare = Share.share as jest.Mock

describe('usePostActions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedBuildReportLink.mockResolvedValue('https://leelagame.app.link/report-42')
  })

  it('handleShareLink shares a report link with localized message', async () => {
    const item = {
      id: 'post-42',
      text: 'My report text',
      plan: 12
    } as any

    const { handleShareLink } = usePostActions({
      item,
      isDetail: true,
      transText: '',
      hideTranslate: true
    })

    await handleShareLink()

    expect(mockedBuildReportLink).toHaveBeenCalledWith('post-42', 'My report text')
    expect(mockedShare).toHaveBeenCalledWith({
      title: 'report.shareTitle:{}',
      message: 'report.shareMessage:{"plan":12,"link":"https://leelagame.app.link/report-42"}'
    })
  })

  it('handleShareLink does nothing when report data is missing', async () => {
    const { handleShareLink } = usePostActions({
      item: undefined,
      isDetail: true,
      transText: '',
      hideTranslate: true
    })

    await handleShareLink()

    expect(mockedBuildReportLink).not.toHaveBeenCalled()
    expect(mockedShare).not.toHaveBeenCalled()
  })
})
