export default {
  requestPermission: jest.fn().mockResolvedValue(true),
  getNotificationSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  onForegroundEvent: jest.fn().mockReturnValue({ remove: jest.fn() }),
  onBackgroundEvent: jest.fn().mockReturnValue({ remove: jest.fn() }),
  createChannel: jest.fn().mockResolvedValue('mock-channel'),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  setBadgeCount: jest.fn().mockResolvedValue(undefined),
  getBadgeCount: jest.fn().mockResolvedValue(0)
}

export const EventType = {
  UNKNOWN: 0,
  DELIVERY: 1,
  PRESS: 2,
  DISMISSED: 3
}
