import { Share } from 'react-native'

import { buildReportLink } from '../../../utils'
import { usePostActions } from './usePostActions'
import { renderHook } from '@testing-library/react-native'

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
  },
  StyleSheet: {
    create: jest.fn((styles: any) => styles)
  },
  Animated: {
    ScrollView: 'ScrollView',
    FlatList: 'FlatList',
    Value: class {},
    timing: () => ({ start: jest.fn() }),
    loop: () => ({ start: jest.fn() }),
    sequence: (arr: any[]) => ({ start: jest.fn() })
  },
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  View: 'View',
  Image: 'Image',
  Text: 'Text',
  Pressable: 'Pressable'
}))

jest.mock('react-native-vector-icons/FontAwesome', () => 'Icon')
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons')
jest.mock('react-native-elements', () => ({
  Icon: 'Icon'
}))
jest.mock('@react-navigation/elements', () => ({
  useHeaderHeight: () => 0
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

    const { result } = renderHook(() =>
      usePostActions({
        item,
        isDetail: true,
        transText: '',
        hideTranslate: true
      })
    )

    await result.current.handleShareLink()

    expect(mockedBuildReportLink).toHaveBeenCalledWith('post-42', 'My report text')
    expect(mockedShare).toHaveBeenCalledWith({
      title: 'report.shareTitle:{}',
      message: 'report.shareMessage:{"plan":12,"link":"https://leelagame.app.link/report-42"}'
    })
  })

  it('handleShareLink does nothing when report data is missing', async () => {
    const { result } = renderHook(() =>
      usePostActions({
        item: undefined,
        isDetail: true,
        transText: '',
        hideTranslate: true
      })
    )

    await result.current.handleShareLink()

    expect(mockedBuildReportLink).not.toHaveBeenCalled()
    expect(mockedShare).not.toHaveBeenCalled()
  })
})
