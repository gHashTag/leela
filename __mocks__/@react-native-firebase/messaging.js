// __mocks__/@react-native-firebase/messaging.js
//
// The module is called as a function - `messaging().subscribeToTopic(...)` -
// so the mock is callable, with the same api attached to the function itself
// for any test that imported the old object form.

const api = {
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  getInitialNotification: jest.fn(),
  requestPermission: jest.fn().mockResolvedValue(1),
  registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  subscribeToTopic: jest.fn().mockResolvedValue(undefined),
  unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue('mock-token'),
  onTokenRefresh: jest.fn().mockReturnValue(jest.fn())
}

const messaging = () => api
Object.assign(messaging, api)
messaging.AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2
}

export default messaging
