export default {
  getVersion: jest.fn(() => '6.5.1'),
  getBuildNumber: jest.fn(() => '1'),
  getBundleId: jest.fn(() => 'com.leelagame'),
  getReadableVersion: jest.fn(() => '6.5.1.1'),
  getSystemVersion: jest.fn(() => '17.0'),
  getModel: jest.fn(() => 'iPhone'),
  getBrand: jest.fn(() => 'Apple'),
  getManufacturer: jest.fn(() => 'Apple'),
  getDeviceId: jest.fn(() => 'mock-device-id'),
  getUniqueId: jest.fn().mockResolvedValue('mock-unique-id')
}

export const getVersion = jest.fn(() => '6.5.1')
export const getBuildNumber = jest.fn(() => '1')
export const getBundleId = jest.fn(() => 'com.leelagame')
export const getReadableVersion = jest.fn(() => '6.5.1.1')
