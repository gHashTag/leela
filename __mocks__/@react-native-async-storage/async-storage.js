// __mocks__/@react-native-async-storage/async-storage.js

const storage = new Map()

export default {
  setItem: jest.fn().mockImplementation(async (key, value) => {
    storage.set(key, value)
    return null
  }),
  getItem: jest
    .fn()
    .mockImplementation(async (key) => storage.get(key) ?? null),
  removeItem: jest.fn().mockImplementation(async (key) => {
    storage.delete(key)
    return null
  }),
  mergeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockImplementation(async () => {
    storage.clear()
    return null
  }),
  getAllKeys: jest
    .fn()
    .mockImplementation(async () => Array.from(storage.keys()))
}
