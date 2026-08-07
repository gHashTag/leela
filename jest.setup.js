global.__DEV__ = true

// Native modules that do not provide a Jest mock file fail with
// "NativeEventEmitter() requires a non-null argument" when loaded under
// react-native-testing-library. Auto-mock any remaining native packages
// so isolated unit tests of exported helpers/components can run.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))

jest.mock('react-native-image-crop-picker', () => ({
  default: {
    openPicker: jest.fn().mockResolvedValue({ path: '/mock/image.jpg' })
  }
}))

jest.mock('react-native-sound', () => ({
  default: jest.fn().mockReturnValue({
    play: jest.fn(),
    release: jest.fn()
  })
}))

jest.mock('react-native-rate', () => ({
  default: { rate: jest.fn() }
}))

jest.mock('react-native-splash-screen', () => ({
  default: { hide: jest.fn() }
}))

jest.mock('react-native-spinkit', () => 'Spinkit')

jest.mock('react-native-system-navigation-bar', () => ({
  default: {
    fullScreen: jest.fn().mockResolvedValue(undefined),
    navigationHide: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('react-native-orientation-locker', () => ({
  default: {
    lockToPortrait: jest.fn()
  }
}))

jest.mock('react-native-video', () => 'Video')
jest.mock('react-native-video-controls', () => 'VideoControls')
jest.mock('react-native-youtube-iframe', () => 'YoutubeIframe')
jest.mock('react-native-webview', () => 'WebView')
jest.mock('react-native-fast-image', () => {
  const FastImage = () => null
  FastImage.priority = { high: 'high', normal: 'normal', low: 'low' }
  return {
    __esModule: true,
    default: FastImage,
    priority: FastImage.priority
  }
})

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  global.ReanimatedDataMock = { now: () => Date.now() }
  return Reanimated
})

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// MobX stores import autoruns at module load time. Provide a minimal store
// shape so imports do not throw while loading components under test.
jest.mock('./src/store', () => ({
  DiceStore: {
    online: false,
    count: 6,
    startGame: false,
    players: 1,
    message: ' ',
    topMessage: ' ',
    multi: 0,
    rate: false,
    finishArr: [true, true, true]
  },
  OfflinePlayers: {
    store: {}
  },
  OnlinePlayer: {
    store: {
      isReported: true,
      canGo: true,
      timeText: '0:00',
      finish: false,
      profile: {},
      loadingProf: false,
      history: [
        { createDate: 1700000000000, plan: 10, count: 4, status: 'cube' }
      ]
    },
    resetGame: jest.fn()
  },
  SubscribeStore: {
    isBlockGame: false
  },
  PostStore: {
    store: {
      posts: [],
      ownPosts: [],
      comments: [],
      replyComments: []
    },
    createComment: jest.fn(),
    replyComment: jest.fn(),
    editComment: jest.fn(),
    delComment: jest.fn(),
    delAllUserComments: jest.fn(),
    fetchComments: jest.fn(),
    fetchOwnPosts: jest.fn(),
    translateText: jest.fn(),
    getOwnerName: jest.fn(),
    getComPlan: jest.fn(),
    getAvaById: jest.fn()
  }
}))
