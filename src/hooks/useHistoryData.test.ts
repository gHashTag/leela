import { useHistoryData } from './useHistoryData'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('../store', () => ({
  DiceStore: { online: false, multi: 2 },
  OfflinePlayers: {
    store: {
      histories: [[{ createDate: 1 }], [{ createDate: 2 }], [], [], [], []]
    }
  },
  OnlinePlayer: { store: { history: [] } }
}))

describe('useHistoryData', () => {
  it('returns offline player histories', () => {
    const result = useHistoryData()
    expect(result.data.length).toBe(2)
    expect(result.data[0].title).toBe('player 1')
    expect(result.data[1].title).toBe('player 2')
    expect(result.data[0].data[0].status).toBeUndefined()
    expect(result.loading).toBe(false)
    expect(result.error).toBeNull()
  })

  it('filters out empty offline sections', () => {
    jest.resetModules()
    jest.doMock('../store', () => ({
      DiceStore: { online: false, multi: 2 },
      OfflinePlayers: {
        store: {
          histories: [[{ createDate: 1 }], [], [], [], [], []]
        }
      },
      OnlinePlayer: { store: { history: [] } }
    }))
    const { useHistoryData: useHistoryDataFresh } = require('./useHistoryData')
    const result = useHistoryDataFresh()
    expect(result.data.length).toBe(1)
    expect(result.data[0].title).toBe('player 1')
  })
})
