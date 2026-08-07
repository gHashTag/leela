export default {
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue({ service: 'mock' }),
  resetGenericPassword: jest.fn().mockResolvedValue(true)
}
