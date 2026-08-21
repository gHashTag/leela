import Branch from 'react-native-branch'

import { linking } from './index'
import { buildReferralLink, buildReportLink } from './linkHelpers'

jest.mock('react-native-branch', () => ({
  createBranchUniversalObject: jest.fn()
}))

jest.mock('../../constants', () => ({
  captureException: jest.fn()
}))

describe('linkHelpers', () => {
  const mockBuo = {
    generateShortUrl: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Branch.createBranchUniversalObject as jest.Mock).mockResolvedValue(
      mockBuo
    )
    mockBuo.generateShortUrl.mockResolvedValue({
      url: 'https://leelagame.app.link/abc123'
    })
  })

  it('buildReportLink generates a short report URL', async () => {
    const url = await buildReportLink('report-42', 'My report text')

    expect(Branch.createBranchUniversalObject).toHaveBeenCalledWith(
      'reply_detail/report-42',
      expect.objectContaining({
        title: 'Link to plan report',
        contentDescription: 'My report text'
      })
    )
    expect(url).toBe('https://leelagame.app.link/abc123')
  })

  it('buildReferralLink generates a short invite URL', async () => {
    const url = await buildReferralLink('user-uid-123')

    expect(Branch.createBranchUniversalObject).toHaveBeenCalledWith(
      'invite/user-uid-123',
      expect.objectContaining({
        title: 'Leela game board invite',
        contentDescription: 'Join me on the Leela game board'
      })
    )
    expect(url).toBe('https://leelagame.app.link/abc123')
  })

  it('buildReferralLink returns "error" when Branch fails', async () => {
    mockBuo.generateShortUrl.mockRejectedValue(new Error('branch failed'))

    const url = await buildReferralLink('user-uid-123')

    expect(url).toBe('error')
  })

  it('linking routes invite/:referralCode to the game board tab', () => {
    const state = (linking.getStateFromPath as any)('invite/friend-code', {})

    expect(state).toEqual({
      routes: [
        {
          name: 'MAIN',
          state: {
            routes: [
              {
                name: 'TAB_BOTTOM_0',
                params: {
                  referralCode: 'friend-code'
                }
              }
            ]
          }
        }
      ]
    })
  })
})
