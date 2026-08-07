const mockSubscribe = jest.fn()

export default {
  subscribe: mockSubscribe,
  skipInit: true,
  initSessionTtl: 5000,
  getLatestReferringParams: jest.fn().mockResolvedValue({}),
  getFirstReferringParams: jest.fn().mockResolvedValue({}),
  setRequestMetadata: jest.fn(),
  createBranchUniversalObject: jest.fn().mockResolvedValue({
    generateShortUrl: jest.fn().mockResolvedValue({ url: 'https://mock.leela.app/link' }),
    showShareSheet: jest.fn().mockResolvedValue({ completed: true })
  })
}

export const BranchEvent = {
  STANDARD_EVENT_ADD_TO_CART: 'ADD_TO_CART',
  STANDARD_EVENT_PURCHASE: 'PURCHASE',
  STANDARD_EVENT_COMPLETE_REGISTRATION: 'COMPLETE_REGISTRATION'
}
