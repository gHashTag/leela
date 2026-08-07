export const useNetInfo = jest.fn(() => ({
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: {}
}))

export default {
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  fetch: jest.fn().mockResolvedValue({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {}
  })
}
