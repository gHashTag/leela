export default {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ data: () => ({}) })),
      set: jest.fn(() => Promise.resolve())
    }))
  }))
}
